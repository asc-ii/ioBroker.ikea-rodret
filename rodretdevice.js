const ACTION_SUFFIX = 'action';
const ACTION_ON = 'on';
const ACTION_OFF = 'off';
const ACTION_BRIGHTNESS_UP = 'brightness_move_up';
const ACTION_BRIGHTNESS_DOWN = 'brightness_move_down';
const ACTION_BRIGHTNESS_STOP = 'brightness_stop';

/**
 * Handles a RODRET button and maps its actions to a LightDevice.
 */
class RodretDevice {
    /**
     * @param {IkeaRodret} adapter ioBroker adapter instance
     * @param {string} rodretId ID of the RODRET device object
     * @param {LightDevice} light Instance of LightDevice to control the light.
     * @throws {Error} if adapter or config is invalid
     */
    constructor(adapter, rodretId, light) {
        if (!adapter) {
            throw new Error('RodretDevice requires an adapter instance');
        }
        if (!rodretId || typeof rodretId !== 'string') {
            throw new Error("RodretDevice requires a non-empty string 'rodretId'");
        }

        this.adapter = adapter;
        this.rodretId = rodretId;
        this.light = light;
    }

    /**
     * Returns the action state ID for this RODRET device.
     *
     * @returns {string} The 'action' datapoint ID of the configured RODRET device.
     */
    get rodretActionId() {
        return `${this.rodretId}.${ACTION_SUFFIX}`;
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
     * Handle a RODRET action and delegate to the light.
     *
     * @param {string} action RODRET action string
     */
    async handleAction(action) {
        switch (action) {
            case ACTION_ON:
                await this.light.switch(true);
                break;
            case ACTION_OFF:
                await this.light.switch(false);
                break;
            case ACTION_BRIGHTNESS_UP:
                await this.light.dimUp();
                break;
            case ACTION_BRIGHTNESS_DOWN:
                await this.light.dimDown();
                break;
            case ACTION_BRIGHTNESS_STOP:
                await this.light.stopDim();
                break;
            default:
                this.adapter.log.warn(`Unknown action ${action} for device ${this.rodretId}`);
                break;
        }
    }
}

module.exports = RodretDevice;
