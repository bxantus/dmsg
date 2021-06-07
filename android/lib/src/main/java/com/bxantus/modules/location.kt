package com.bxantus.modules

import android.annotation.SuppressLint
import com.bxantus.messaging.DataObject
import com.bxantus.messaging.Module
import com.google.android.gms.location.LocationServices
import android.location.Location as AndroidLocation
import kotlinx.coroutines.tasks.await

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

class LocationProvider(private val webActivity: WebActivity) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(webActivity)

    @SuppressLint("MissingPermission")
    suspend fun getLastLocation():Location? {
        return when (val loc:AndroidLocation? = fusedLocationClient.lastLocation.await()) {
            null -> null
            else -> Location(loc)
        }
    }
}