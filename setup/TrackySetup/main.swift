import AppKit
import Foundation
import SwiftUI

enum SetupStep: Int, CaseIterable, Hashable {
    case welcome, check, install, finish

    var title: String {
        switch self {
        case .welcome: return "Welcome"
        case .check: return "System check"
        case .install: return "Install"
        case .finish: return "Ready"
        }
    }
}

@MainActor
final class SetupModel: ObservableObject {
    @Published var step: SetupStep = .welcome
    @Published var runtimeText = "Checking for a supported Python installation…"
    @Published var checkPassed = false
    @Published var isInstalling = false
    @Published var setupText = "Installing Tracky…"
    @Published var errorText: String?

    private var payloadURL: URL { Bundle.main.url(forResource: "JobAgent", withExtension: "pkg")! }
    private var runtimeURL: URL { Bundle.main.url(forResource: "python_runtime", withExtension: "py")! }

    func checkRuntime() {
        errorText = nil
        let candidates = ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"]
        Task.detached { [runtimeURL] in
            for candidate in candidates where FileManager.default.isExecutableFile(atPath: candidate) {
                let process = Process()
                let output = Pipe()
                process.executableURL = URL(fileURLWithPath: candidate)
                process.arguments = [runtimeURL.path, "--json"]
                process.standardOutput = output
                do {
                    try process.run()
                    process.waitUntilExit()
                    let data = output.fileHandleForReading.readDataToEndOfFile()
                    if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let selected = object["selected"] as? [String: Any],
                       let version = selected["major"] as? Int,
                       let minor = selected["minor"] as? Int,
                       let path = selected["path"] as? String {
                        await MainActor.run {
                            self.runtimeText = "Python \(version).\(minor) selected\n\(path)"
                            self.checkPassed = true
                        }
                        return
                    }
                } catch { continue }
            }
            await MainActor.run {
                self.runtimeText = "Tracky requires standard CPython 3.11 or newer."
                self.checkPassed = false
            }
        }
    }

    func install() {
        guard FileManager.default.fileExists(atPath: payloadURL.path) else {
            errorText = "The Tracky installation payload is missing."
            return
        }
        isInstalling = true
        errorText = nil
        let command = "do shell script \"/usr/sbin/installer -pkg \(shellQuote(payloadURL.path)) -target /\" with administrator privileges"
        Task.detached { [command] in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
            process.arguments = ["-e", command]
            do {
                try process.run()
                process.waitUntilExit()
                await MainActor.run {
                    if process.terminationStatus == 0 { self.bootstrap() }
                    else { self.isInstalling = false; self.errorText = "Installation was not completed. You can try again." }
                }
            } catch {
                await MainActor.run { self.isInstalling = false; self.errorText = error.localizedDescription }
            }
        }
    }

    func bootstrap() {
        isInstalling = true
        setupText = "Installing Python dependencies and browser support…"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = ["/usr/local/share/jobagent/bootstrap_runtime.sh"]
        Task.detached {
            do {
                try process.run()
                process.waitUntilExit()
                await MainActor.run {
                    self.isInstalling = false
                    if process.terminationStatus == 0 { self.step = .finish }
                    else { self.errorText = "Tracky could not finish its runtime setup. Check your network connection and try again." }
                }
            } catch {
                await MainActor.run { self.isInstalling = false; self.errorText = error.localizedDescription }
            }
        }
    }

    func openPrivacySettings() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")!)
    }

    func openDashboard() {
        NSWorkspace.shared.open(URL(string: "http://127.0.0.1:5050")!)
    }

    private func shellQuote(_ path: String) -> String {
        "'" + path.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}

struct TrackySetupView: View {
    @StateObject private var model = SetupModel()

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            HStack(spacing: 0) {
                rail
                Divider()
                content
            }
            Divider()
            controls
        }
        .frame(width: 760, height: 520)
        .onAppear { model.checkRuntime() }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Text("T").font(.system(size: 22, weight: .bold)).foregroundStyle(Color(red: 0.97, green: 0.84, blue: 0.56)).frame(width: 42, height: 42).background(Color(red: 0.06, green: 0.18, blue: 0.33)).clipShape(RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 1) { Text("Tracky Setup").font(.headline); Text("Local job discovery for macOS").font(.caption).foregroundStyle(.secondary) }
            Spacer()
        }.padding(.horizontal, 22).padding(.vertical, 14)
    }

    private var rail: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(SetupStep.allCases, id: \.self) { item in
                HStack(spacing: 9) {
                    Circle().fill(item.rawValue <= model.step.rawValue ? Color.accentColor : Color.secondary.opacity(0.18)).frame(width: 9, height: 9)
                    Text(item.title).font(.system(size: 13, weight: item == model.step ? .semibold : .regular)).foregroundStyle(item == model.step ? .primary : .secondary)
                }
            }
            Spacer()
        }.frame(width: 175, alignment: .leading).padding(22)
    }

    private var content: some View {
        VStack(spacing: 16) {
            Spacer()
            Group {
                switch model.step {
                case .welcome: welcome
                case .check: check
                case .install: install
                case .finish: finish
                }
            }
            Spacer()
        }.frame(maxWidth: .infinity).padding(.horizontal, 46)
    }

    private var welcome: some View { VStack(spacing: 12) { Text("Find better jobs faster.").font(.system(size: 30, weight: .bold)); Text("Tracky brings job discovery, matching keywords, and alerts into one quiet background service.").multilineTextAlignment(.center).foregroundStyle(.secondary).frame(maxWidth: 410); Text("Your data and job history stay on this Mac.").font(.caption).foregroundStyle(.secondary) } }

    private var check: some View { VStack(spacing: 14) { Text("System check").font(.title2.bold()); Text(model.runtimeText).multilineTextAlignment(.center).font(.callout).foregroundStyle(model.checkPassed ? .primary : .secondary); if !model.checkPassed { ProgressView().controlSize(.small) } } }

    private var install: some View { VStack(spacing: 14) { Text("Install Tracky").font(.title2.bold()); Text("The dashboard, background scanner, and menu bar app will be installed on this Mac.").multilineTextAlignment(.center).foregroundStyle(.secondary); if model.isInstalling { ProgressView(model.setupText) } } }

    private var finish: some View { VStack(spacing: 14) { Text("Tracky is ready").font(.title2.bold()); Text("Review your keywords and notification settings, then run a test scan from the dashboard.").multilineTextAlignment(.center).foregroundStyle(.secondary); HStack { Button("Open Privacy Settings") { model.openPrivacySettings() }; Button("Open Dashboard") { model.openDashboard() }.buttonStyle(.borderedProminent) } } }

    private var controls: some View {
        HStack { Button("Quit") { NSApplication.shared.terminate(nil) }.keyboardShortcut(.cancelAction); Spacer(); if model.step == .welcome { Button("Continue") { model.step = .check; model.checkRuntime() }.buttonStyle(.borderedProminent) } else if model.step == .check { Button("Continue") { model.step = .install }.buttonStyle(.borderedProminent).disabled(!model.checkPassed) } else if model.step == .install { Button(model.isInstalling ? "Installing…" : "Install Tracky") { model.install() }.buttonStyle(.borderedProminent).disabled(model.isInstalling) } else { Button("Done") { NSApplication.shared.terminate(nil) }.buttonStyle(.borderedProminent) } }.padding(.horizontal, 22).padding(.vertical, 13)
    }
}

@main
struct TrackySetupApp: App {
    var body: some Scene { WindowGroup { TrackySetupView() } }
}
