import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    /// Extra runtime so Gus can keep streaming briefly while the user checks mail / locks the phone.
    private var gusBackgroundTask: UIBackgroundTaskIdentifier = .invalid

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        endGusBackgroundTask(application)
        gusBackgroundTask = application.beginBackgroundTask(withName: "gus-chat-stream") { [weak self] in
            guard let self else { return }
            self.endGusBackgroundTask(application)
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        endGusBackgroundTask(application)
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
        endGusBackgroundTask(application)
    }

    private func endGusBackgroundTask(_ application: UIApplication) {
        guard gusBackgroundTask != .invalid else { return }
        application.endBackgroundTask(gusBackgroundTask)
        gusBackgroundTask = .invalid
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
