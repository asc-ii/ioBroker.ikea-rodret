const ACTION_ON = 'on';
const ACTION_OFF = 'off';
const ACTION_BRIGHTNESS_UP = 'brightness_move_up';
const ACTION_BRIGHTNESS_DOWN = 'brightness_move_down';
const ACTION_BRIGHTNESS_STOP = 'brightness_stop';
const DEFAULT_MOVE_SPEED = 50;

/**
 * Represents a Light device that can be controlled (switch, dimming)
 * by one or multiple RODRETs.
 */
class LightDevice {
    /**
     * @param {IkeaRodret} adapter ioBroker adapter instance
     * @param {string} lightId ID of the light *root object*
     * @throws {Error} if adapter or config is invalid
     */
    constructor(adapter, lightId) {
        if (!adapter) {
            throw new Error('LightDevice requires an adapter instance');
        }
        if (!lightId || typeof lightId !== 'string') {
            throw new Error("LightDevice requires a non-empty string 'lightId'");
        }

        this.adapter = adapter;
        this.lightRootId = lightId;

        /** Switch state ID */
        this.switchId = null;
        /** Brightness move state ID */
        this.brightnessMoveId = null;
        /** Level/brightness state ID */
        this.levelId = null;
        /** Default move speed for dimming */
        this.minMoveSpeed = -DEFAULT_MOVE_SPEED;
        this.maxMoveSpeed = DEFAULT_MOVE_SPEED;
        /** rodretId currently controlling this light */
        this.activeController = null;
    }

    /**
     * Initialize the light device by discovering its states.
     * - Finds switch, brightness_move, transition_time, and level states.
     * - Reads min/max move speeds from brightness_move state if available.
     * - Sets transitionTime = 0 if transition_time not found.
     *
     * @throws {Error} if validation fails
     */
    async init() {
        this.adapter.log.debug(`Initializing light device ${this.lightRootId}`);

        // Load the light root object
        const lightObj = await this.adapter.getForeignObjectAsync(this.lightRootId);
        if (!lightObj) {
            throw new Error(`Light root object ${this.lightRootId} not found`);
        }

        // Discover child states and find 'switch' and 'brightness_move'
        const children = await this.adapter.getForeignObjectsAsync(`${this.lightRootId}.*`);
        if (!children || Object.keys(children).length === 0) {
            throw new Error(`Light ${this.lightRootId} has no child states`);
        }

        for (const id in children) {
            const obj = children[id];

            this.adapter.log.silly(`Inspecting light state ${JSON.stringify(obj)}`);

            if (!obj?.common) {
                this.adapter.log.debug(`Skipping light state ${id} without common property`);
                continue;
            }

            const id_lowercase = id.toLowerCase();
            const role = obj.common.role;

            // find: switch
            if (role === 'switch') {
                this.switchId = id;
                this.adapter.log.debug(`Found switch state for light ${this.lightRootId}: ${id}`);
            }

            // find: brightness_move
            if (id_lowercase.endsWith('.brightness_move')) {
                this.brightnessMoveId = id;
                this.minMoveSpeed = obj.common?.min ?? -DEFAULT_MOVE_SPEED;
                this.maxMoveSpeed = obj.common?.max ?? DEFAULT_MOVE_SPEED;
                this.adapter.log.debug(`Found brightness_move state for light ${this.lightRootId}: ${id}`);
            }

            // find: dim level
            if (id_lowercase.endsWith('.level') || id_lowercase.endsWith('.brightness') || role === 'level.dimmer') {
                this.levelId = id;
                this.adapter.log.debug(`Found brightness/level state for light ${this.lightRootId}: ${id}`);
            }
        }

        if (!this.switchId) {
            // Critical: switch state is required
            throw new Error(`Light ${this.lightRootId} has no switch state`);
        }

        if (!this.brightnessMoveId) {
            this.adapter.log.warn(
                `Light ${this.lightRootId} has no brightness_move state - dimming will not be supported`,
            );
        }
        if (!this.levelId) {
            this.adapter.log.warn(
                `Light ${this.lightRootId} has no level/brightness state, auto-stop dimming not supported`,
            );
        }

        if (this.minMoveSpeed > 0) {
            this.minMoveSpeed = -this.minMoveSpeed;
        }
    }

    /**
     * Switch the light on or off.
     *
     * @param {boolean} onOrOff Desired state
     */
    async _switch(onOrOff) {
        if (!this.switchId) {
            throw new Error(`No switch state found for light ${this.lightRootId}`);
        }
        await this.adapter.setForeignStateAsync(this.switchId, { val: onOrOff });
    }

    /**
     * Start brightening the light.
     * If the light is currently off, it will be switched on first.
     * Then brightness_move is set to positive moveSpeed to start dimming up.
     */
    async _dimUp() {
        // 1. Read the current switch state
        const state = await this.adapter.getForeignStateAsync(this.switchId);

        // 2. If the light is off, turn it on first
        if (!state?.val) {
            await this._switch(true); // switch on if off
        }

        // 3. Start brightness_move for dimming up
        await this._startMove(+this.maxMoveSpeed);
    }

    /**
     * Start dimming the light down.
     * If the current brightness is 0 or lower, the light will be switched off.
     * Otherwise, brightness_move is set to negative moveSpeed to start dimming down.
     */
    async _dimDown() {
        if (!this.brightnessMoveId) {
            return;
        }

        // Check current brightness
        if (this.levelId) {
            const brightnessState = await this.adapter.getForeignStateAsync(this.levelId);
            if (brightnessState?.val <= 0) {
                await this._switch(false);
                return;
            }
        }

        await this._startMove(this.minMoveSpeed, this.transitionTime);
    }

    /**
     * Stop dimming (sets brightness_move to 0) and clears any running interval.
     */
    async _stopDim() {
        if (this.brightnessMoveId) {
            await this.adapter.setForeignStateAsync(this.brightnessMoveId, { val: 0 });
        }
    }

    /**
     * Internal helper to set brightness_move and transition_time.
     *
     * @param {number} speed Move speed (positive or negative)
     */
    async _startMove(speed) {
        if (!this.brightnessMoveId) {
            this.adapter.log.warn(`Light ${this.lightRootId} does not support brightness_move`);
            return;
        }

        // Start brightness_move
        await this.adapter.setForeignStateAsync(this.brightnessMoveId, { val: speed });
    }

    /**
     * Handles an action command coming from a RODRET.
     * Prevents concurrent control by multiple RODRETs.
     *
     * @param {string} action - The action command (on/off/dim-up/dim-down/dim-stop).
     * @param {string} rodretId - The ID of the RODRET issuing the action.
     */
    async handleAction(action, rodretId) {
        console.log('#### 0 ');
        throw new Error('aaaa');
        switch (action) {
            case ACTION_BRIGHTNESS_UP:
            case ACTION_BRIGHTNESS_DOWN:
                if (this.activeController && this.activeController !== rodretId) {
                    this.adapter.log.info(
                        `Light ${this.lightRootId} is currently controlled by ${this.activeController}, ignoring ${rodretId}`,
                    );
                    return;
                }
                this.activeController = rodretId;
                if (action === ACTION_BRIGHTNESS_UP) {
                    await this._dimUp();
                } else {
                    await this._dimDown();
                }
                break;

            case ACTION_BRIGHTNESS_STOP:
                if (this.activeController === rodretId) {
                    await this._stopDim();
                    this.activeController = null;
                }
                break;

            case ACTION_ON:
                console.log('1');
                await this._switch(true);
                break;

            case ACTION_OFF:
                await this._switch(false);
                break;
        }
    }
}

module.exports = LightDevice;
