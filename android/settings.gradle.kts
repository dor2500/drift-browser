// Drift for Android: a native Kotlin + Jetpack Compose shell around Android's
// Chromium WebView, with Mozilla's GeckoView as a second engine. Shares Drift's look, spaces, ad blocking and GitHub releases
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
        // GeckoView (Firefox's engine) is published by Mozilla.
        maven("https://maven.mozilla.org/maven2/")
    }
}
rootProject.name = "Drift"
include(":app")
