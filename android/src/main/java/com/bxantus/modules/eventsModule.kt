package com.bxantus.modules

import com.bxantus.messaging.Module
import com.bxantus.messaging.RemoteObject

class Events {
    private val backButton = SystemEvent("back")
    val module = object : Module() {
        val back = backButton
        val state = object {
            fun setCanGoBack(canGo:Boolean) {
                backAvailable = canGo
            }
        }
    }

    fun backPressed() {
        backButton.trigger()
    }

    private var backAvailable = true
    val canGoBack get() = backAvailable
}

class EventHandler(val id: Int, val cb/*callback*/:RemoteObject)

/**
 * Represents an event (like back key pressed) to which users can subscribe via messaging
 */
class SystemEvent(val name:String) {
    private val handlers = mutableListOf<EventHandler>()

    /**
     * Use this method to subscribe to an event
     * will return an unique id for the event registration
     */
    fun on(handler:RemoteObject):Int {
        val id =  if (handlers.isNotEmpty()) handlers.last().id + 1 else 1
        handlers.add(EventHandler(id, handler))
        return id
    }

    fun off(handlerId:Int) {
        handlers.removeAt(handlers.indexOfFirst { it.id == handlerId } )
    }

    // todo: trigger shouldn't be accessible through RemoteObject interface
    //       event and event emitter separation would be beneficial
    fun trigger(vararg args:Any) {
        for (handler in handlers) {
            handler.cb.callAsync(args)
        }
    }
}