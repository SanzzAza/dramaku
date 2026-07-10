package com.dramaku.app;

import android.annotation.SuppressLint;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;

import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaItem.SubtitleConfiguration;
import androidx.media3.common.MimeTypes;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private FrameLayout playerContainer;
    private PlayerView playerView;
    private ExoPlayer player;
    private ImageButton btnClose;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (getSupportActionBar() != null) getSupportActionBar().hide();
        getWindow().setStatusBarColor(Color.parseColor("#070b0f"));
        getWindow().setNavigationBarColor(Color.parseColor("#070b0f"));

        // Root layout
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#070b0f"));

        // WebView
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Native Player container (hidden by default)
        playerContainer = new FrameLayout(this);
        playerContainer.setBackgroundColor(Color.BLACK);
        playerContainer.setVisibility(View.GONE);
        root.addView(playerContainer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // ExoPlayer view
        playerView = new PlayerView(this);
        playerView.setUseController(true);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerContainer.addView(playerView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // Close button
        btnClose = new ImageButton(this);
        btnClose.setImageResource(android.R.drawable.ic_menu_close_clear_cancel);
        btnClose.setBackgroundColor(Color.argb(120, 0, 0, 0));
        btnClose.setPadding(24, 24, 24, 24);
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(120, 120);
        closeParams.setMargins(24, 48, 0, 0);
        btnClose.setOnClickListener(v -> closeNativePlayer());
        playerContainer.addView(btnClose, closeParams);

        setContentView(root);

        // Setup WebView
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        // JavaScript interface for native player
        webView.addJavascriptInterface(new NativePlayerBridge(), "NativePlayer");

        webView.loadUrl("file:///android_asset/index.html");
    }

    /**
     * Bridge: JS calls NativePlayer.play(url, subtitleUrl, title)
     * to open native ExoPlayer for HEVC/any format
     */
    public class NativePlayerBridge {
        @JavascriptInterface
        public void play(String videoUrl, String subtitleUrl, String title) {
            runOnUiThread(() -> openNativePlayer(videoUrl, subtitleUrl, title));
        }
    }

    private void openNativePlayer(String videoUrl, String subtitleUrl, String title) {
        // Create player
        if (player != null) {
            player.release();
        }
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        // Build media item with optional subtitle
        MediaItem.Builder builder = new MediaItem.Builder().setUri(Uri.parse(videoUrl));

        if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
            List<SubtitleConfiguration> subs = new ArrayList<>();
            subs.add(new SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                    .setMimeType(MimeTypes.APPLICATION_SUBRIP)
                    .setLanguage("id")
                    .setLabel("Indonesia")
                    .setSelectionFlags(androidx.media3.common.C.SELECTION_FLAG_DEFAULT)
                    .build());
            builder.setSubtitleConfigurations(subs);
        }

        player.setMediaItem(builder.build());
        player.prepare();
        player.play();

        // Show player, hide webview
        playerContainer.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);

        // Allow landscape for movies
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
    }

    private void closeNativePlayer() {
        if (player != null) {
            player.stop();
            player.release();
            player = null;
        }
        playerContainer.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }

    @Override
    public void onBackPressed() {
        if (playerContainer.getVisibility() == View.VISIBLE) {
            closeNativePlayer();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) player.pause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
