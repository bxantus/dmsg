package com.bxantus.modules

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.bxantus.messaging.DataObject
import com.bxantus.messaging.Module
import kotlinx.coroutines.*

class PermissionsModule(webActivity: WebActivity) : Module() {
    val permissions = object : DataObject() {
        // NOTE: not all dangerous permissions are listed yet
        val accessBackgroundLocation = Manifest.permission.ACCESS_BACKGROUND_LOCATION
        val accessCoarseLocation = Manifest.permission.ACCESS_COARSE_LOCATION
        val accessFineLocation = Manifest.permission.ACCESS_FINE_LOCATION
    }
    val permissionManager = PermissionManager(webActivity)
}

class PermissionManager(private val webActivity: WebActivity) {
    data class CheckResult(val granted:Boolean, val shouldShowRationale:Boolean)
    data class Request(val code:Int, val response:CompletableDeferred<Boolean>)
    private val requests = mutableListOf<Request>()

    init {
        // will be called from activity's onPermissionResult function
        webActivity.addPermissionHandler { forRequest, permissions, results ->
            val idx = requests.indexOfFirst { it.code == forRequest }
            if (idx >= 0) {
                val req = requests[idx]
                requests.removeAt(idx)
                // resolve outer suspended function with the results
                if (permissions.isNotEmpty() && results.isNotEmpty()) { // not cancelled
                    req.response.complete(results[0] == PackageManager.PERMISSION_GRANTED)
                } else req.response.complete(false) // treat cancelled as permission denied}
            }
        }
    }

    fun check(permission:String):CheckResult {
        val granted = ContextCompat.checkSelfPermission(webActivity, permission)
        var shouldShowRationale = false
        if (granted == PackageManager.PERMISSION_DENIED) {
            shouldShowRationale = webActivity.shouldShowRequestPermissionRationale(permission)
        }
        return CheckResult(granted == PackageManager.PERMISSION_GRANTED, shouldShowRationale)
    }


    suspend fun request(permission:String):Boolean {
        val requestCode = (requests.getOrNull(requests.lastIndex)?.code ?: 0) + 1
        val response = CompletableDeferred<Boolean>()
        requests.add(Request(requestCode, response))

        webActivity.requestPermissions(arrayOf(permission), requestCode)
        // see `init` for response's completion
        return response.await()
    }
}