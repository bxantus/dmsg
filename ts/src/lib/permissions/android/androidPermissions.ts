import { IPermissionManager, Permission } from '../permissionManager.ts'

export interface PermissionsModule {
    permissions : {
        // NOTE: not all dangerous permissions are listed yet
        accessBackgroundLocation:string
        accessCoarseLocation:string
        accessFineLocation:string
    }
    permissionManager:AndroidPermissionManager
}

export interface AndroidPermissionManager {
    /**
     * Check if a given runtime permission is granted to the app 
     * 
     * will return with a Checkresult, detailing whether the permission is granted,
     * and if it's not, you should show a rationale dialog before requesting access to the permission from the system
     */
    check(permission:string):Promise<{granted:boolean, shouldShowRationale:boolean}>
    /**
     * Requests access to a given runtime permission
     * Will return whether the permission was granted, or it was denied (or the dialog cancelled)
     */
    request(permission:string):Promise<boolean>
}

/// Implementation of IPermissionManager for Android
export class PermissionManager implements IPermissionManager {
    private permissionMap = new Map<Permission, string>()
    constructor(private module:PermissionsModule) {
        this.permissionMap.set("locationAccessFine", module.permissions.accessFineLocation)
        this.permissionMap.set("locationAccessBackground", module.permissions.accessBackgroundLocation)
    }

    async check(permission:Permission) {
        const androidName = this.permissionMap.get(permission)
        return androidName ? this.module.permissionManager.check(androidName) : {granted:false, shouldShowRationale:false}
    }

    async request(permission:Permission) {
        const androidName = this.permissionMap.get(permission)
        return androidName ? this.module.permissionManager.request(androidName) : false
    }
}