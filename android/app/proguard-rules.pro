# WebView JavaScript bridge (none exposed today); keep WebView client callbacks.
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }
