// Drift for Android: a native Kotlin + Jetpack Compose shell around Android's
// Chromium WebView. Shares Drift's look, spaces, ad blocking and GitHub releases
// with the desktop app; built by .github/workflows/release.yml.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "Drift"
include(":app")
