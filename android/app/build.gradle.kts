plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Same version as the desktop app (package.json), so one release tag covers both.
val repo: File = rootDir.parentFile
val appVersion = Regex("\"version\"\\s*:\\s*\"([0-9.]+)\"").find(repo.resolve("package.json").readText())!!.groupValues[1]
val appCode = appVersion.split(".").map { it.toInt() }.let { (maj, min, pat) -> maj * 10000 + min * 100 + pat }

// Release signing: CI passes the keystore through environment variables (GitHub secrets);
// locally ~/.android/drift.jks + drift.pass. Without either, the debug key is used.
val ciStore = System.getenv("DRIFT_KEYSTORE")?.let { File(it) }
val localStore = File(System.getProperty("user.home"), ".android/drift.jks")
val localPass = File(System.getProperty("user.home"), ".android/drift.pass")
val storeFileFound = ciStore?.takeIf { it.isFile } ?: localStore.takeIf { it.isFile }
val storePass = System.getenv("DRIFT_KEYSTORE_PASSWORD") ?: localPass.takeIf { it.isFile }?.readText()?.trim()

android {
    namespace = "app.drift.browser"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.drift.browser"
        minSdk = 26
        targetSdk = 37
        versionCode = appCode
        versionName = appVersion
    }

    signingConfigs {
        if (storeFileFound != null && storePass != null) {
            create("release") {
                storeFile = storeFileFound
                storePassword = storePass
                keyAlias = "drift"
                keyPassword = storePass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3:1.5.0-beta02")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.webkit:webkit:1.14.0")
}
