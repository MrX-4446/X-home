package com.x.home.plugins;

import android.content.Intent;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatOverlay")
public class FloatOverlayPlugin extends Plugin {

    private FloatOverlayService floatOverlayService;
    private PluginCall pendingOcrCall;

    @Override
    public void load() {
        floatOverlayService = new FloatOverlayService(getActivity());
        FloatOverlayService.setOcrCallback(new FloatOverlayService.OcrResultCallback() {
            @Override
            public void onOcrResult(String text) {
                if (pendingOcrCall != null) {
                    pendingOcrCall.resolve(new JSObject().put("success", true).put("text", text));
                    pendingOcrCall = null;
                }
            }

            @Override
            public void onOcrProgress(int progress) {
                if (pendingOcrCall != null) {
                    pendingOcrCall.saveCall();
                }
            }
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!checkOverlayPermission()) {
            call.resolve(new JSObject().put("success", false).put("message", "需要悬浮窗权限"));
            return;
        }
        getActivity().startService(new Intent(getActivity(), FloatOverlayService.class));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().stopService(new Intent(getActivity(), FloatOverlayService.class));
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void toggle(PluginCall call) {
        if (FloatOverlayService.isRunning) {
            getActivity().stopService(new Intent(getActivity(), FloatOverlayService.class));
            call.resolve(new JSObject().put("success", true).put("visible", false));
        } else {
            if (!checkOverlayPermission()) {
                call.resolve(new JSObject().put("success", false).put("message", "需要悬浮窗权限"));
                return;
            }
            getActivity().startService(new Intent(getActivity(), FloatOverlayService.class));
            call.resolve(new JSObject().put("success", true).put("visible", true));
        }
    }

    @PluginMethod
    public void isVisible(PluginCall call) {
        call.resolve(new JSObject().put("visible", FloatOverlayService.isRunning));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        boolean granted = checkOverlayPermission();
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getActivity().getPackageName()));
            getActivity().startActivity(intent);
        }
        call.resolve(new JSObject().put("granted", granted));
    }

    @PluginMethod
    public void setPosition(PluginCall call) {
        int x = call.getInt("x", 0);
        int y = call.getInt("y", 0);
        FloatOverlayService.updatePosition(x, y);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void setSize(PluginCall call) {
        int width = call.getInt("width", 100);
        int height = call.getInt("height", 100);
        FloatOverlayService.updateSize(width, height);
        call.resolve(new JSObject().put("success", true));
    }

    @PluginMethod
    public void startOcr(PluginCall call) {
        if (!checkOverlayPermission()) {
            call.resolve(new JSObject().put("success", false).put("message", "需要悬浮窗权限"));
            return;
        }

        if (!checkScreenCapturePermission()) {
            call.resolve(new JSObject().put("success", false).put("message", "需要屏幕录制权限"));
            return;
        }

        pendingOcrCall = call;
        call.saveCall();

        if (!FloatOverlayService.isRunning) {
            getActivity().startService(new Intent(getActivity(), FloatOverlayService.class));
        }

        new Thread(() -> {
            try {
                Thread.sleep(500);
                getActivity().runOnUiThread(() -> {
                    if (FloatOverlayService.floatView != null) {
                        android.view.View btnOcr = FloatOverlayService.floatView.findViewById(R.id.btn_ocr);
                        if (btnOcr != null) {
                            btnOcr.performClick();
                        }
                    }
                });
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }).start();
    }

    @PluginMethod
    public void startScrollCapture(PluginCall call) {
        if (!checkOverlayPermission()) {
            call.resolve(new JSObject().put("success", false).put("message", "需要悬浮窗权限"));
            return;
        }

        pendingOcrCall = call;
        call.saveCall();

        if (!FloatOverlayService.isRunning) {
            getActivity().startService(new Intent(getActivity(), FloatOverlayService.class));
        }

        new Thread(() -> {
            try {
                Thread.sleep(500);
                getActivity().runOnUiThread(() -> {
                    if (FloatOverlayService.floatView != null) {
                        android.view.View btnOcr = FloatOverlayService.floatView.findViewById(R.id.btn_ocr);
                        if (btnOcr != null) {
                            btnOcr.performClick();
                        }
                    }
                });
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }).start();
    }

    private boolean checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(getActivity());
        }
        return true;
    }

    private boolean checkScreenCapturePermission() {
        return true;
    }
}
