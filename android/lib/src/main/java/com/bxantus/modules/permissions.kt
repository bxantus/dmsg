package com.bxantus.modules

import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.bxantus.messaging.Module
import kotlinx.coroutines.*

class Permissions : Module() {
    
}

class PermissionManager(private val webActivity: WebActivity) {
    data class CheckResult(val granted:Boolean, val shouldShowRationale:Boolean)

    fun check(permission:String):CheckResult {
        val granted = ContextCompat.checkSelfPermission(webActivity, permission)
        var shouldShowRationale = false
        if (granted == PackageManager.PERMISSION_DENIED) {
            shouldShowRationale = webActivity.shouldShowRequestPermissionRationale(permission)
        }
        return CheckResult(granted == PackageManager.PERMISSION_GRANTED, shouldShowRationale)
    }

    private val requests = mutableListOf<Int>()
    suspend fun request(permission:String):Boolean {
        val requestCode = requests.getOrElse(requests.lastIndex) { 0 } + 1
        requests.add(requestCode)
        val response = CompletableDeferred<Boolean>()
        webActivity.addPermissionHandler{ forRequest, permissions, results->
            if (forRequest == requestCode) {
                // resolve outer suspended function with the results
                if (permissions.isNotEmpty() && results.isNotEmpty()) { // not cancelled
                    response.complete(results[0] == PackageManager.PERMISSION_GRANTED)
                } else response.complete(false) // treat cancelled as permission denied
            }
            // todo: should use a single permission handler for all requests
            //       requests can store the deferred response
        }
        webActivity.requestPermissions(arrayOf(permission), requestCode)
        return response.await()
    }
}