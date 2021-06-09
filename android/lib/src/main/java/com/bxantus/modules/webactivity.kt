package com.bxantus.modules

import android.app.Activity
import android.content.Intent
import android.util.Log

typealias PermissionHandler = (requestCode: Int,
                               permissions: Array<out String>,
                               grantResults: IntArray) -> Unit

open class WebActivity : Activity() {
    private val permissionHandlers = mutableListOf<PermissionHandler>()
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        Log.i("webActivity", "onActivityResult, reqCode: $requestCode, result: $resultCode")
    }
}