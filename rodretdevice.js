const ACTION_SUFFIX = 'action';

/**
 * Handles a RODRET button and maps its actions to a LightDevice.
 */
class RodretDevice {
    /**
     * @param {IkeaRodret} adapter ioBroker adapter instance
     * @param {string} rodretId ID of the RODRET device object
     * @throws {Error} if adapter or config is invalid
     */
    constructor(adapter, rodretId) {
        if (!adapter) {
            throw new Error('RodretDevice requires an adapter instance');
        }
        if (!rodretId || typeof rodretId !== 'string') {
            throw new Error("RodretDevice requires a non-empty string 'rodretId'");
        }

        this.adapter = adapter;
        this.rodretId = rodretId;
        this.lights = [];
        this.rodretActionId = `${this.rodretId}.${ACTION_SUFFIX}`;
    }

    /**
     * Validate the RODRET device and its linked light.
     *
     * @throws {Error} if validation fails
     */
    async init() {
        // Load the RODRET device object
        this.adapter.log.debug(`Initializing RODRET device ${this.rodretId}`);

        const deviceObj = await this.adapter.getForeignObjectAsync(this.rodretId);
        if (!deviceObj) {
            throw new Error(`RODRET device ${this.rodretId} not found`);
        }
        if (deviceObj.type !== 'device' || !deviceObj.common?.type?.toLowerCase().includes('e2201')) {
            throw new Error(`Configured object ${this.rodretId} is not a valid RODRET device`);
        }

        // Verify that the device has an .action state
        const actionState = await this.adapter.getForeignObjectAsync(this.rodretActionId);
        if (!actionState) {
            throw new Error(`RODRET device ${this.rodretId} has no '${ACTION_SUFFIX}' state`);
        }

        // Get name of rodret object
        this.name = deviceObj?.common?.name || 'Unknown';
    }

    /**
     * Subscribe to the action state.
     */
    async subscribe() {
        await this.adapter.subscribeForeignStatesAsync(this.rodretActionId);
        this.adapter.log.info(`Subscribed to ${this.rodretActionId}`);
    }

    /**
     * Adds a LightDevice instance to this RODRET.
     * Prevents duplicate lights.
     *
     * @param {LightDevice} light - The light to attach.
     */
    addLight(light) {
        if (this.lights.find(l => l.lightRootId === light.lightRootId)) {
            this.adapter.log.warn(
                `RODRET ${this.rodretId} already has light ${light.lightRootId}, skipping duplicate.`,
            );
            return;
        }
        this.lights.push(light);
    }

    /**
     * Handle a RODRET action and delegate to the light.
     *
     * @param {string} action RODRET action string
     */
    async handleAction(action) {
        for (const light of this.lights) {
            await light.handleAction(action, this.rodretId);
        }
    }
}

module.exports = RodretDevice;
