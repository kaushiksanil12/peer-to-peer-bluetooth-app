package com.econet.ble

/**
 * A simple singleton to hold a reference to the running BleMeshService instance.
 * This allows ViewModels and other parts of the app to easily access
 * the service's public methods like sendMessage() and connectToEndpoint().
 */
object ServiceManager {
    var bleMeshService: BleMeshService? = null
}