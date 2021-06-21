package com.bxantus.modules

import android.app.Activity
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred

typealias PermissionHandler = (requestCode: Int,
                               permissions: Array<out String>,
                               grantResults: IntArray) -> Unit

class ActivityRequest(public val requestCode:Int, public val response:Deferred<Int>) {
}

open class WebActivity : Activity() {
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
}