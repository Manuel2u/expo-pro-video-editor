import ExpoModulesCore

public class ExpoProVideoEditorModule: Module {
  /// Active render jobs, keyed by the caller-supplied task id.
  ///
  /// Mirrors `ProVideoEditorPlugin.activeRenderTasks`: tracked so a second
  /// `render` call reusing the same `id` is rejected instead of silently
  /// racing another job, and so `cancelRender` can find the job to stop.
  private var activeRenderHandles: [String: RenderJobHandle] = [:]

  /// Whether the task for `id` was cancelled by an explicit `cancelRender`
  /// call, as opposed to a pipeline cancelling itself (a stalled-export
  /// watchdog, a refused start). Both surface as `CancellationError`, but only
  /// the former is a genuine user-requested cancel — see `errorCode(for:)`.
  private var explicitlyCancelled: Set<String> = []

  public func definition() -> ModuleDefinition {
    Name("ExpoProVideoEditor")

    Events("onRenderProgress")

    AsyncFunction("render") { (args: [String: Any], id: String, promise: Promise) in
      guard !id.isEmpty else {
        promise.reject(ExpoProVideoEditorError.invalidArguments("Missing task id"))
        return
      }

      guard self.activeRenderHandles[id] == nil else {
        promise.reject(ExpoProVideoEditorError.taskAlreadyRunning(id))
        return
      }

      guard let config = RenderConfig.fromArguments(args) else {
        promise.reject(ExpoProVideoEditorError.invalidArguments("Invalid render configuration"))
        return
      }

      self.sendEvent("onRenderProgress", ["id": id, "progress": 0.0])

      let handle = RenderVideo.render(
        config: config,
        onProgress: { progress in
          self.sendEvent("onRenderProgress", ["id": id, "progress": progress])
        },
        onComplete: { outputData in
          DispatchQueue.main.async {
            self.sendEvent("onRenderProgress", ["id": id, "progress": 1.0])
            self.activeRenderHandles.removeValue(forKey: id)
            self.explicitlyCancelled.remove(id)
            promise.resolve(outputData)
          }
        },
        onError: { error in
          PluginLog.print("❌ Render failed: \(error.localizedDescription)")
          DispatchQueue.main.async {
            self.activeRenderHandles.removeValue(forKey: id)
            let wasCancelled = self.explicitlyCancelled.remove(id) != nil
            promise.reject(
              ExpoProVideoEditorError.renderFailed(
                canceled: wasCancelled, error: error))
          }
        }
      )

      self.activeRenderHandles[id] = handle
    }

    AsyncFunction("cancelRender") { (id: String, promise: Promise) in
      guard !id.isEmpty else {
        promise.reject(ExpoProVideoEditorError.invalidArguments("Missing task id"))
        return
      }

      guard let handle = self.activeRenderHandles[id] else {
        promise.reject(ExpoProVideoEditorError.taskNotFound(id))
        return
      }

      self.explicitlyCancelled.insert(id)
      handle.cancel()
      promise.resolve(nil)
    }
  }
}

/// Errors thrown across the JS boundary. Expo Modules API converts a thrown
/// `Exception` into a JS `Error` carrying `.code` and `.message`, the same
/// shape `FlutterError`'s `code`/`message` gave the Flutter side.
///
/// `Exception`'s JS-visible message is built from `debugDescription`, which
/// always reads its `reason` property — not the `description` passed to
/// `Exception(name:description:code:)` (that only feeds Swift-side
/// `CustomStringConvertible` logging). `reason` defaults to the literal
/// string `"undefined reason"` unless overridden, so every exception here
/// must be this subclass rather than a plain `Exception(name:description:code:)`
/// call, or its message reaches JS as "undefined reason".
private final class ExpoProVideoEditorException: Exception, @unchecked Sendable {
  private let reasonMessage: String

  init(name: String, reason: String, code: String) {
    self.reasonMessage = reason
    super.init(name: name, description: reason, code: code)
  }

  override var reason: String { reasonMessage }
}

private enum ExpoProVideoEditorError {
  static func invalidArguments(_ message: String) -> Exception {
    ExpoProVideoEditorException(name: "INVALID_ARGUMENTS", reason: message, code: "INVALID_ARGUMENTS")
  }

  static func taskAlreadyRunning(_ id: String) -> Exception {
    ExpoProVideoEditorException(
      name: "TASK_ALREADY_RUNNING", reason: "Task with id \(id) is already running",
      code: "TASK_ALREADY_RUNNING")
  }

  static func taskNotFound(_ id: String) -> Exception {
    ExpoProVideoEditorException(
      name: "TASK_NOT_FOUND", reason: "No task found for id \(id)", code: "TASK_NOT_FOUND")
  }

  /// A pipeline can also cancel itself (a stalled-export watchdog, a refused
  /// start), so a bare `CancellationError` is a cancellation even when
  /// `canceled` (an explicit `cancelRender` call) is false.
  static func renderFailed(canceled: Bool, error: Error) -> Exception {
    let code = (canceled || error is CancellationError) ? "CANCELED" : "RENDER_ERROR"
    return ExpoProVideoEditorException(name: code, reason: error.localizedDescription, code: code)
  }
}
