export type Permission = "locationAccessFine" | "locationAccessBackground"

export interface IPermissionManager {
    /**
     * Check if a given runtime permission is granted to the app 
     * 
     * will return with a Checkresult, detailing whether the permission is granted,
     * and if it's not, you should show a rationale dialog before requesting access to the permission from the system
     */
     check(permission:Permission):Promise<{granted:boolean, shouldShowRationale:boolean}>
     /**
      * Requests access to a given runtime permission
      * Will return whether the permission was granted, or it was denied (or the dialog cancelled)
      */
     request(permission:Permission):Promise<boolean>
}