package com.bxantus.modules

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import com.bxantus.messaging.android.MessagingInterface
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred

typealias PermissionHandler = (requestCode: Int,
                               permissions: Array<out String>,
                               grantResults: IntArray) -> Unit

class ActivityRequest(public val requestCode:Int, public val response:Deferred<Int>) {
}

abstract class WebActivity : Activity() {
    private val permissionHandlers = mutableListOf<PermissionHandler>()
    private val activityRequests = mutableListOf<ActivityRequest>()
    private val pendingActivityRequests = mutableMapOf<Int, CompletableDeferred<Int>>()
    fun addPermissionHandler(handler:PermissionHandler) {
        permissionHandlers.add(handler)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        // will dispatch request results to all handlers
        // if handlers maintain their request codes correctly, multiple handlers won't receive the same results
        for (handler in permissionHandlers) {
            handler(requestCode, permissions, grantResults);
        }
    }

    fun createActivityRequest():ActivityRequest {
        val response = CompletableDeferred<Int>()
        val requestCode =  if (activityRequests.isNotEmpty())
                            activityRequests.last().requestCode + 1
                           else 1;
        val request = ActivityRequest(requestCode, response)
        activityRequests.add(request)
        pendingActivityRequests[requestCode] = response
        return request
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val response = pendingActivityRequests.remove(requestCode) ?: return
        activityRequests.removeAt(activityRequests.indexOfFirst { it.requestCode == requestCode })
        response.complete(resultCode) // NOTE: maybe data may be added too to response
    }

    @ExperimentalStdlibApi
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WebView.setWebContentsDebuggingEnabled(true)

        var webView = WebView(this)
        webView.settings.javaScriptEnabled = true

        val messaging = MessagingInterface(webView)
        webView.addJavascriptInterface(messaging, "androidMessaging")
        setupWebView(webView)

        val startPage = initialize(messaging)
        webView.loadUrl("https://appassets.androidplatform.net/assets/$startPage")

        // set this webView as the main content in the activity
        setContentView(webView)
    }

    /**
     * Export any needed modules by your app via messaging
     * @return the starting url of your app to be loaded inside the webView
     *         the Url should be relative to the assets folder, webActivity will prepend the hostName
     *         (ex. 'www/index.html')
     */
    @ExperimentalStdlibApi
    abstract fun initialize(messaging:MessagingInterface):String

    private fun setupWebView(webView:WebView) {
        val assetLoader = WebViewAssetLoader.Builder() // by default uses: https://appassets.androidplatform.net
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.webViewClient = object: WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                return if (request != null)
                    assetLoader.shouldInterceptRequest(request.url)
                else return super.shouldInterceptRequest(view, request as WebResourceRequest)
            }
        }
    }
}