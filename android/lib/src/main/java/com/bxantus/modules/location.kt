package com.bxantus.modules

import android.annotation.SuppressLint
import com.bxantus.messaging.DataObject
import com.bxantus.messaging.Module
import com.bxantus.messaging.RemoteObject
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.*
import android.location.Location as AndroidLocation
import kotlinx.coroutines.tasks.await

@ExperimentalStdlibApi
class LocationModule(webActivity: WebActivity) : Module() {
    val locationProvider = LocationProvider(webActivity)
}

class Location(loc:AndroidLocation) : DataObject() {
    val longitude = loc.longitude
    val latitude = loc.latitude
    val altitude = loc.altitude
    val bearing = loc.bearing
    val accuracy = loc.accuracy
    val speed = loc.speed
}

@ExperimentalStdlibApi
class LocationProvider(private val webActivity: WebActivity) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(webActivity)

    @SuppressLint("MissingPermission")
    suspend fun getLastLocation():Location? {
        return when (val loc:AndroidLocation? = fusedLocationClient.lastLocation.await()) {
            null -> null
            else -> Location(loc)
        }
    }

    fun createLocationRequest(interval:Int): LocationRequest =
        LocationRequest.create().apply {
            this.interval = interval.toLong()
            fastestInterval = interval.toLong()
            // note: maybe later we could pass priority as an argument too
            priority = LocationRequest.PRIORITY_HIGH_ACCURACY
        }

    /// checks whether settings are enabled for this kind of location request
    suspend fun checkSettings(req:LocationRequest):Boolean {
        val settingsReqBuilder = LocationSettingsRequest.Builder()
        settingsReqBuilder.addLocationRequest(req);

        val client: SettingsClient = LocationServices.getSettingsClient(webActivity)
        return try {
            client.checkLocationSettings(settingsReqBuilder.build()).await()
            true
        } catch (e:Exception) {
            if (e is ResolvableApiException) {
                val reqCode = 1 // todo: get a new request code for launching activity, similar to permission requests
                e.startResolutionForResult(webActivity, reqCode)
                // todo: wait for activity result and return true when it wasn't canceled (see CompletableDeferred)
                //       result code of -1 means user enabled location from settings, 0 means cancelled (from logged experience)
            }
            false
        }
    }

    /// starts location updates for the request created with createLocationRequest
    /// expects listener to be a simple callable object (ex. a function), it will be called with new locations
    /// @returns a location callback object, this can be used to stop new updates
    @SuppressLint("MissingPermission")
    fun requestUpdates(req:LocationRequest, listener:RemoteObject):LocationCallback {
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult?) {
                locationResult ?: return
                for (location in locationResult.locations){
                    listener.callAsync(Location(location))
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(req, locationCallback, webActivity.mainLooper)
        return locationCallback
    }

    fun stopUpdates(cb:LocationCallback) {
        fusedLocationClient.removeLocationUpdates(cb)
    }
}