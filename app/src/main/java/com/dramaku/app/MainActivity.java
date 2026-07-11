package com.dramaku.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String HOME_URL = "file:///android_asset/index.html";

    private FrameLayout root;
    private WebView webView;
    private LinearLayout recoveryView;
    private TextView recoveryMessage;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prepareWindow();

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 8, 13));
        setContentView(root, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        createWebView();
        createRecoveryView();
        loadHome();
    }

    private void prepareWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.BLACK);
        window.setNavigationBarColor(Color.BLACK);
        window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void createWebView() {
        if (webView != null) {
            try {
                root.removeView(webView);
                webView.destroy();
            } catch (Exception ignored) {}
            webView = null;
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 8, 13));
        root.addView(webView, 0, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        configureWebView();
        webView.addJavascriptInterface(new NativeBridge(), "NativeApp");
        webView.addJavascriptInterface(new NativePlayerBridge(), "NativePlayer");
    }

    private void createRecoveryView() {
        recoveryView = new LinearLayout(this);
        recoveryView.setOrientation(LinearLayout.VERTICAL);
        recoveryView.setGravity(Gravity.CENTER);
        recoveryView.setPadding(dp(24), dp(24), dp(24), dp(24));
        recoveryView.setBackgroundColor(Color.rgb(5, 8, 13));
        recoveryView.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("Dramaku butuh dimuat ulang");
        title.setTextColor(Color.rgb(239, 255, 247));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        recoveryView.addView(title, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        recoveryMessage = new TextView(this);
        recoveryMessage.setText("WebView berhenti atau halaman gagal dimuat. Coba muat ulang aplikasi.");
        recoveryMessage.setTextColor(Color.rgb(145, 164, 186));
        recoveryMessage.setTextSize(13);
        recoveryMessage.setGravity(Gravity.CENTER);
        recoveryMessage.setPadding(0, dp(10), 0, dp(18));
        recoveryView.addView(recoveryMessage, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        Button reload = new Button(this);
        reload.setText("Muat Ulang");
        reload.setAllCaps(false);
        reload.setOnClickListener(v -> reloadWebView());
        recoveryView.addView(reload, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
        ));

        Button clear = new Button(this);
        clear.setText("Bersihkan Cache & Muat Ulang");
        clear.setAllCaps(false);
        clear.setOnClickListener(v -> clearCacheAndReload());
        LinearLayout.LayoutParams clearParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
        );
        clearParams.topMargin = dp(10);
        recoveryView.addView(clear, clearParams);

        root.addView(recoveryView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                hideRecovery();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    String message = "Halaman utama gagal dimuat.";
                    if (error != null) message = String.valueOf(error.getDescription());
                    showRecovery(message);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                showRecovery("WebView berhenti tiba-tiba. Tekan Muat Ulang untuk membuka Dramaku lagi.");
                try {
                    if (webView != null) {
                        root.removeView(webView);
                        webView.destroy();
                    }
                } catch (Exception ignored) {}
                webView = null;
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                customView.setBackgroundColor(Color.BLACK);
                ViewGroup decor = (ViewGroup) getWindow().getDecorView();
                decor.addView(customView, new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                ));
                webView.setVisibility(View.GONE);
                setImmersiveMode(true);
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }
        });
    }

    private void loadHome() {
        if (webView == null) createWebView();
        hideRecovery();
        webView.loadUrl(HOME_URL);
    }

    private void reloadWebView() {
        runOnUiThread(() -> {
            if (webView == null) createWebView();
            loadHome();
            Toast.makeText(this, "Memuat ulang Dramaku...", Toast.LENGTH_SHORT).show();
        });
    }

    private void clearCacheAndReload() {
        runOnUiThread(() -> {
            try {
                if (webView != null) {
                    webView.clearCache(true);
                    webView.clearHistory();
                }
                CookieManager.getInstance().removeAllCookies(null);
                CookieManager.getInstance().flush();
            } catch (Exception ignored) {}
            reloadWebView();
        });
    }

    private void showRecovery(String message) {
        runOnUiThread(() -> {
            setImmersiveMode(false);
            if (recoveryMessage != null && message != null) recoveryMessage.setText(message);
            if (webView != null) webView.setVisibility(View.GONE);
            if (recoveryView != null) recoveryView.setVisibility(View.VISIBLE);
        });
    }

    private void hideRecovery() {
        if (recoveryView != null) recoveryView.setVisibility(View.GONE);
        if (webView != null) webView.setVisibility(View.VISIBLE);
    }

    private void hideCustomView() {
        if (customView == null) return;
        ViewGroup decor = (ViewGroup) getWindow().getDecorView();
        decor.removeView(customView);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        if (webView != null) webView.setVisibility(View.VISIBLE);
        setImmersiveMode(false);
    }

    private void setImmersiveMode(boolean enabled) {
        View decor = getWindow().getDecorView();
        if (enabled) {
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        } else {
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        if (recoveryView != null && recoveryView.getVisibility() == View.VISIBLE) {
            finish();
            return;
        }
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript("(window.handleNativeBack&&window.handleNativeBack())===true", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try { webView.destroy(); } catch (Exception ignored) {}
            webView = null;
        }
        super.onDestroy();
    }

    public class NativeBridge {
        @JavascriptInterface
        public void setFullscreen(boolean enabled) {
            runOnUiThread(() -> setImmersiveMode(enabled));
        }

        @JavascriptInterface
        public void keepAwake(boolean enabled) {
            runOnUiThread(() -> {
                if (enabled) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void haptic(String type) {
            runOnUiThread(() -> {
                try {
                    getWindow().getDecorView().performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                    Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                    if (vibrator != null) {
                        long ms = "heavy".equals(type) ? 28L : 12L;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                        } else {
                            vibrator.vibrate(ms);
                        }
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public String getVersion() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                return info.versionName == null ? "3.6" : info.versionName;
            } catch (Exception e) {
                return "3.6";
            }
        }

        @JavascriptInterface
        public void share(String title, String text, String url) {
            runOnUiThread(() -> {
                try {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Dramaku" : title);
                    String body = (text == null ? "" : text) + ((url == null || url.isEmpty()) ? "" : "\n" + url);
                    send.putExtra(Intent.EXTRA_TEXT, body);
                    startActivity(Intent.createChooser(send, title == null ? "Bagikan" : title));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Tidak ada aplikasi untuk berbagi", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void clearWebViewCache() {
            runOnUiThread(() -> {
                try {
                    if (webView != null) {
                        webView.clearCache(true);
                        webView.clearHistory();
                    }
                    Toast.makeText(MainActivity.this, "Cache WebView dibersihkan", Toast.LENGTH_SHORT).show();
                } catch (Exception ignored) {}
            });
        }
    }

    public class NativePlayerBridge {
        @JavascriptInterface
        public void play(String url, String subtitleUrl, String title) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerActivity.class);
                    i.putExtra("url", url);
                    i.putExtra("subtitle", subtitleUrl == null ? "" : subtitleUrl);
                    i.putExtra("title", title == null ? "Dramaku" : title);
                    startActivity(i);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Gagal membuka native player", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
