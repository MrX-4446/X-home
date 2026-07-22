package com.x.home.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;

import androidx.core.app.NotificationCompat;

import com.x.home.R;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class FloatOverlayService extends Service {

    public static boolean isRunning = false;
    public static View floatView = null;
    private static WindowManager windowManager;
    private static WindowManager.LayoutParams layoutParams;
    private static int viewWidth = 60;
    private static int viewHeight = 180;

    private float touchStartX;
    private float touchStartY;
    private int windowStartX;
    private int windowStartY;

    private MediaProjection mediaProjection;
    private ImageReader imageReader;
    private Handler handler;
    private HandlerThread handlerThread;
    private boolean isCapturing = false;
    private List<Bitmap> capturedImages = new ArrayList<>();

    private static OcrResultCallback ocrCallback;

    public interface OcrResultCallback {
        void onOcrResult(String text);
        void onOcrProgress(int progress);
    }

    public static void setOcrCallback(OcrResultCallback callback) {
        ocrCallback = callback;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
        createNotificationChannel();
        startForeground(1, createNotification());
        showFloatView();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        stopCapture();
        removeFloatView();
    }

    private void showFloatView() {
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);

        LayoutInflater inflater = (LayoutInflater) getSystemService(Context.LAYOUT_INFLATER_SERVICE);
        floatView = inflater.inflate(R.layout.float_overlay, null);

        layoutParams = new WindowManager.LayoutParams();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutParams.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutParams.type = WindowManager.LayoutParams.TYPE_PHONE;
        }

        layoutParams.format = PixelFormat.RGBA_8888;
        layoutParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;

        layoutParams.gravity = Gravity.TOP | Gravity.LEFT;
        layoutParams.x = 0;
        layoutParams.y = 500;
        layoutParams.width = dpToPx(viewWidth);
        layoutParams.height = dpToPx(viewHeight);

        floatView.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        touchStartX = event.getRawX();
                        touchStartY = event.getRawY();
                        windowStartX = layoutParams.x;
                        windowStartY = layoutParams.y;
                        return false;
                    case MotionEvent.ACTION_MOVE:
                        int deltaX = (int) (event.getRawX() - touchStartX);
                        int deltaY = (int) (event.getRawY() - touchStartY);
                        layoutParams.x = windowStartX + deltaX;
                        layoutParams.y = windowStartY + deltaY;
                        windowManager.updateViewLayout(floatView, layoutParams);
                        return true;
                    case MotionEvent.ACTION_UP:
                        return false;
                }
                return false;
            }
        });

        ImageButton btnOcr = floatView.findViewById(R.id.btn_ocr);
        btnOcr.setOnClickListener(v -> {
            startScrollCapture();
        });

        ImageButton btnNotes = floatView.findViewById(R.id.btn_notes);
        btnNotes.setOnClickListener(v -> {
            Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (intent != null) {
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
                startActivity(intent);
            }
        });

        ImageButton btnClose = floatView.findViewById(R.id.btn_close);
        btnClose.setOnClickListener(v -> {
            stopSelf();
        });

        windowManager.addView(floatView, layoutParams);
    }

    private void removeFloatView() {
        if (floatView != null && windowManager != null) {
            try {
                windowManager.removeView(floatView);
            } catch (Exception e) {
                e.printStackTrace();
            }
            floatView = null;
        }
    }

    private void startScrollCapture() {
        if (isCapturing) return;

        capturedImages.clear();
        isCapturing = true;

        MediaProjectionManager projectionManager =
                (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);

        Intent permissionIntent = projectionManager.createScreenCaptureIntent();
        permissionIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivityForResult(permissionIntent, 100);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 100 && resultCode == RESULT_OK) {
            MediaProjectionManager projectionManager =
                    (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);

            mediaProjection = projectionManager.getMediaProjection(resultCode, data);

            int screenWidth = getResources().getDisplayMetrics().widthPixels;
            int screenHeight = getResources().getDisplayMetrics().heightPixels;

            imageReader = ImageReader.newInstance(screenWidth, screenHeight, 0x1, 2);

            handlerThread = new HandlerThread("CaptureThread");
            handlerThread.start();
            handler = new Handler(handlerThread.getLooper());

            mediaProjection.createVirtualDisplay(
                    "ScreenCapture",
                    screenWidth, screenHeight,
                    getResources().getDisplayMetrics().densityDpi,
                    0,
                    imageReader.getSurface(),
                    null,
                    handler
            );

            captureNextFrame();
        } else {
            isCapturing = false;
            if (ocrCallback != null) {
                ocrCallback.onOcrResult("用户取消了截图权限");
            }
        }
    }

    private int captureCount = 0;
    private static final int MAX_CAPTURES = 5;

    private void captureNextFrame() {
        if (!isCapturing || captureCount >= MAX_CAPTURES) {
            stopCapture();
            processImages();
            return;
        }

        Image image = imageReader.acquireLatestImage();
        if (image != null) {
            Image.Plane[] planes = image.getPlanes();
            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int rowPadding = rowStride - pixelStride * image.getWidth();

            Bitmap bitmap = Bitmap.createBitmap(
                    image.getWidth() + rowPadding / pixelStride,
                    image.getHeight(),
                    Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);

            bitmap = Bitmap.createBitmap(bitmap, 0, 0, image.getWidth(), image.getHeight());
            capturedImages.add(bitmap);

            image.close();

            if (ocrCallback != null) {
                ocrCallback.onOcrProgress((captureCount + 1) * 20);
            }
        }

        captureCount++;

        handler.postDelayed(() -> {
            if (isCapturing) {
                captureNextFrame();
            }
        }, 300);
    }

    private void stopCapture() {
        isCapturing = false;
        captureCount = 0;

        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }

        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }

        if (handlerThread != null) {
            handlerThread.quitSafely();
            try {
                handlerThread.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            handlerThread = null;
        }

        handler = null;
    }

    private void processImages() {
        if (capturedImages.isEmpty()) {
            if (ocrCallback != null) {
                ocrCallback.onOcrResult("未捕获到图像");
            }
            return;
        }

        Bitmap mergedBitmap = mergeImagesVertically(capturedImages);
        String base64Image = bitmapToBase64(mergedBitmap);

        for (Bitmap bmp : capturedImages) {
            bmp.recycle();
        }
        capturedImages.clear();
        mergedBitmap.recycle();

        if (ocrCallback != null) {
            ocrCallback.onOcrResult(base64Image);
        }
    }

    private Bitmap mergeImagesVertically(List<Bitmap> images) {
        int totalHeight = 0;
        int maxWidth = 0;

        for (Bitmap image : images) {
            totalHeight += image.getHeight();
            if (image.getWidth() > maxWidth) {
                maxWidth = image.getWidth();
            }
        }

        Bitmap merged = Bitmap.createBitmap(maxWidth, totalHeight, Bitmap.Config.ARGB_8888);

        int currentY = 0;
        for (Bitmap image : images) {
            android.graphics.Canvas canvas = new android.graphics.Canvas(merged);
            canvas.drawBitmap(image, 0, currentY, null);
            currentY += image.getHeight();
        }

        return merged;
    }

    private String bitmapToBase64(Bitmap bitmap) {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream);
        byte[] bytes = outputStream.toByteArray();
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(bytes);
    }

    public static void updatePosition(int x, int y) {
        if (floatView != null && windowManager != null) {
            layoutParams.x = x;
            layoutParams.y = y;
            windowManager.updateViewLayout(floatView, layoutParams);
        }
    }

    public static void updateSize(int width, int height) {
        if (floatView != null && windowManager != null) {
            viewWidth = width;
            viewHeight = height;
            layoutParams.width = width;
            layoutParams.height = height;
            windowManager.updateViewLayout(floatView, layoutParams);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "float_overlay",
                    "阅读助手悬浮窗",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification createNotification() {
        return new NotificationCompat.Builder(this, "float_overlay")
                .setContentTitle("阅读助手")
                .setContentText("悬浮窗已启动")
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .build();
    }

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }
}
