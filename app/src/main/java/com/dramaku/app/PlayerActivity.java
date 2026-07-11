package com.dramaku.app;

import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import java.util.Collections;

public class PlayerActivity extends AppCompatActivity {
    private ExoPlayer player;
    private PlayerView playerView;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setImmersive(true);

        playerView = new PlayerView(this);
        playerView.setBackgroundColor(Color.BLACK);
        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        setContentView(playerView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        String url = getIntent().getStringExtra("url");
        String subtitle = getIntent().getStringExtra("subtitle");
        if (url == null || url.trim().isEmpty()) {
            Toast.makeText(this, "URL video kosong", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);
        player.setMediaItem(buildMediaItem(url, subtitle));
        player.prepare();
        player.play();
    }

    private MediaItem buildMediaItem(String url, String subtitle) {
        MediaItem.Builder builder = new MediaItem.Builder().setUri(Uri.parse(url));
        if (subtitle != null && !subtitle.trim().isEmpty()) {
            String lower = subtitle.toLowerCase();
            String mime = lower.endsWith(".vtt") ? MimeTypes.TEXT_VTT : MimeTypes.APPLICATION_SUBRIP;
            MediaItem.SubtitleConfiguration sub = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitle))
                    .setMimeType(mime)
                    .setLanguage("id")
                    .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                    .build();
            builder.setSubtitleConfigurations(Collections.singletonList(sub));
        }
        return builder.build();
    }

    private void setImmersive(boolean enabled) {
        if (!enabled) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    protected void onPause() {
        if (player != null) player.pause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onDestroy();
    }
}
