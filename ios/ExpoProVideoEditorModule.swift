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
private enum ExpoProVideoEditorError {
  static func invalidArguments(_ message: String) -> Exception {
    Exception(name: "INVALID_ARGUMENTS", description: message, code: "INVALID_ARGUMENTS")
  }

  static func taskAlreadyRunning(_ id: String) -> Exception {
    Exception(
      name: "TASK_ALREADY_RUNNING", description: "Task with id \(id) is already running",
      code: "TASK_ALREADY_RUNNING")
  }

  static func taskNotFound(_ id: String) -> Exception {
    Exception(
      name: "TASK_NOT_FOUND", description: "No task found for id \(id)", code: "TASK_NOT_FOUND")
  }

  /// A pipeline can also cancel itself (a stalled-export watchdog, a refused
  /// start), so a bare `CancellationError` is a cancellation even when
  /// `canceled` (an explicit `cancelRender` call) is false.
  static func renderFailed(canceled: Bool, error: Error) -> Exception {
    let code = (canceled || error is CancellationError) ? "CANCELED" : "RENDER_ERROR"
    return Exception(name: code, description: error.localizedDescription, code: code)
  }
}
