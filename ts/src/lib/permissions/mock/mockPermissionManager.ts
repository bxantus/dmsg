import { IPermissionManager, Permission } from '../permissionManager.ts'

export class MockPermissionManager implements IPermissionManager {
    private permissions:{[key in Permission]:boolean}
    constructor(enabled:boolean = false, private showRationale:boolean = true) {
        this.permissions= {
            locationAccessFine: enabled,
            locationAccessBackground: enabled
        }
    }

    async check(permission:Permission) {
        const granted = this.permissions[permission]
        return {granted, shouldShowRationale: !granted && this.showRationale }
    }

    async request(permission:Permission) {
        return this.permissions[permission]
    }
}