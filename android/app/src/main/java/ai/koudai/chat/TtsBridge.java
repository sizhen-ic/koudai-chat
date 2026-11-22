package ai.koudai.chat;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * 语音朗读：把网页里要读的文字交给系统 TTS 引擎。
 * 用系统自带语音，不联网、不花钱，音色取决于手机里装了什么引擎。
 */
public class TtsBridge {

    private final WebView web;
    private TextToSpeech tts;
    private boolean ready = false;
    private String lastId = "";

    public TtsBridge(WebView web) {
        this.web = web;
    }

    /** 在 Activity 里调用一次，异步初始化引擎 */
    public void init(Context ctx) {
        tts = new TextToSpeech(ctx.getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
            ready = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
        });

        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) { }

            @Override
            public void onDone(String utteranceId) {
                if (utteranceId != null && utteranceId.equals(lastId)) notifyDone();
            }

            @Override
            public void onError(String utteranceId) {
                if (utteranceId != null && utteranceId.equals(lastId)) notifyDone();
            }

            @Override
            public void onError(String utteranceId, int errorCode) {
                if (utteranceId != null && utteranceId.equals(lastId)) notifyDone();
            }
        });
    }

    @JavascriptInterface
    public boolean ready() {
        return ready;
    }

    @JavascriptInterface
    public boolean speak(String text, float rate) {
        if (tts == null || !ready || text == null) return false;
        tts.stop();
        float r = rate <= 0f ? 1f : Math.min(2.5f, Math.max(0.4f, rate));
        tts.setSpeechRate(r);

        List<String> parts = split(text, 3000);
        if (parts.isEmpty()) return false;
        for (int i = 0; i < parts.size(); i++) {
            String id = UUID.randomUUID().toString();
            lastId = id;   // 只有最后一段的结束才算"读完"
            Bundle params = new Bundle();
            tts.speak(parts.get(i), TextToSpeech.QUEUE_ADD, params, id);
        }
        return true;
    }

    @JavascriptInterface
    public void stop() {
        if (tts != null) {
            tts.stop();
            lastId = "";
        }
    }

    public void shutdown() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) { }
            tts = null;
            ready = false;
        }
    }

    /** 系统引擎单次最多约 4000 字，按句子切开更自然 */
    private static List<String> split(String text, int max) {
        List<String> out = new ArrayList<>();
        String rest = text.trim();
        while (rest.length() > 0) {
            if (rest.length() <= max) {
                out.add(rest);
                break;
            }
            int cut = -1;
            for (int i = Math.min(max, rest.length() - 1); i > max / 2; i--) {
                char c = rest.charAt(i);
                if (c == '。' || c == '！' || c == '？' || c == '\n' || c == '.' || c == '!' || c == '?') {
                    cut = i + 1;
                    break;
                }
            }
            if (cut <= 0) cut = max;
            out.add(rest.substring(0, cut));
            rest = rest.substring(cut).trim();
        }
        return out;
    }

    private void notifyDone() {
        if (web == null) return;
        web.post(() -> {
            try {
                web.evaluateJavascript("window.__ttsDone&&window.__ttsDone()", null);
            } catch (Exception ignored) { }
        });
    }
}
