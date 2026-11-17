package ai.koudai.chat;

import android.content.Context;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;

/**
 * 数据桥：把网页那边的整份状态写成 App 私有目录里的一个 JSON 文件。
 *
 *   files/data/state.json          当前数据（临时文件 + rename，原子替换）
 *   files/data/backups/*.json      历史快照，保留最近 30 份
 *
 * 这个目录属于 App 沙盒：清理浏览器缓存、换浏览器都不影响；卸载 App 才会删除。
 */
public class StoreBridge {

    private static final long BACKUP_GAP_MS = 10L * 60L * 1000L;
    private static final int KEEP_BACKUPS = 30;

    private final File dir;
    private final File stateFile;
    private final File backupDir;
    private long lastBackupAt = 0L;

    public StoreBridge(Context ctx) {
        dir = new File(ctx.getFilesDir(), "data");
        if (!dir.exists()) dir.mkdirs();
        stateFile = new File(dir, "state.json");
        backupDir = new File(dir, "backups");
    }

    /** 读出整份状态；没有就返回空字符串。 */
    @JavascriptInterface
    public String load() {
        try {
            if (!stateFile.exists() || stateFile.length() == 0) return "";
            InputStream in = new FileInputStream(stateFile);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    /** 原子写入整份状态；必要时顺带留一份快照。 */
    @JavascriptInterface
    public boolean save(String json) {
        try {
            File tmp = new File(dir, "state.json.tmp");
            FileOutputStream out = new FileOutputStream(tmp);
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.flush();
            out.getFD().sync();
            out.close();

            if (stateFile.exists() && !stateFile.delete()) {
                // 少数文件系统上 delete 可能失败，仍尝试覆盖
            }
            if (!tmp.renameTo(stateFile)) {
                tmp.delete();
                return false;
            }

            long now = System.currentTimeMillis();
            if (now - lastBackupAt > BACKUP_GAP_MS) {
                lastBackupAt = now;
                writeSnapshot(json);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** 立即留一份快照。 */
    @JavascriptInterface
    public boolean snapshot() {
        String cur = load();
        if (cur.isEmpty()) return false;
        return writeSnapshot(cur);
    }

    /** 给设置页显示用。 */
    @JavascriptInterface
    public String info() {
        long size = stateFile.exists() ? stateFile.length() : 0L;
        return dir.getAbsolutePath() + "\n" + size + " 字节";
    }

    private boolean writeSnapshot(String json) {
        try {
            if (!backupDir.exists()) backupDir.mkdirs();
            String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
            File f = new File(backupDir, "state-" + stamp + ".json");
            FileOutputStream out = new FileOutputStream(f);
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.flush();
            out.getFD().sync();
            out.close();
            prune();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void prune() {
        File[] files = backupDir.listFiles();
        if (files == null || files.length <= KEEP_BACKUPS) return;
        Arrays.sort(files, new Comparator<File>() {
            @Override
            public int compare(File a, File b) { return a.getName().compareTo(b.getName()); }
        });
        for (int i = 0; i < files.length - KEEP_BACKUPS; i++) {
            files[i].delete();
        }
    }
}
