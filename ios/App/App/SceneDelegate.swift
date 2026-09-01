import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var gusBackgroundTask: UIBackgroundTaskIdentifier = .invalid

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        let application = UIApplication.shared
        endGusBackgroundTask()
        gusBackgroundTask = application.beginBackgroundTask(withName: "gus-chat-stream") { [weak self] in
            self?.endGusBackgroundTask()
        }
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        endGusBackgroundTask()
    }

    private func endGusBackgroundTask() {
        guard gusBackgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(gusBackgroundTask)
        gusBackgroundTask = .invalid
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
