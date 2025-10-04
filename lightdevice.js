/**
 * Handles light control logic (switch, dimming).
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
        this.moveSpeed = 50;
    }

    /**
     * Validate the configured light and discover its states.
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

            if (role === 'switch') {
                this.switchId = id;
                this.adapter.log.debug(`Found switch state for light ${this.lightRootId}: ${id}`);
            } else if (id_lowercase.endsWith('.brightness_move')) {
                this.brightnessMoveId = id;
                this.adapter.log.debug(`Found brightness_move state for light ${this.lightRootId}: ${id}`);
            } else if (
                id_lowercase.endsWith('.level') ||
                id_lowercase.endsWith('.brightness') ||
                role === 'level.dimmer'
            ) {
                this.levelId = id;
                this.adapter.log.debug(`Found brightness/level state for light ${this.lightRootId}: ${id}`);
            }
        }

        if (!this.switchId) {
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
    }

    /**
     * Switch the light on or off.
     *
     * @param {boolean} onOrOff Desired state
     */
    async switch(onOrOff) {
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
    async dimUp() {
        // 1. Read the current switch state
        const state = await this.adapter.getForeignStateAsync(this.switchId);

        // 2. If the light is off, turn it on first
        if (!state?.val) {
            await this.switch(true); // switch on if off
        }

        // 3. Start brightness_move for dimming up
        await this._startMove(+this.moveSpeed);
    }

    /**
     * Start dimming the light down.
     * If the current brightness is 0 or lower, the light will be switched off.
     * Otherwise, brightness_move is set to negative moveSpeed to start dimming down.
     */
    async dimDown() {
        if (!this.brightnessMoveId) {
            return;
        }

        // Check current brightness
        if (this.levelId) {
            const brightnessState = await this.adapter.getForeignStateAsync(this.levelId);
            if (brightnessState?.val <= 0) {
                await this.switch(false);
                return;
            }
        }

        await this._startMove(-this.moveSpeed, this.transitionTime);
    }

    /**
     * Stop dimming (sets brightness_move to 0) and clears any running interval.
     */
    async stopDim() {
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
}

module.exports = LightDevice;
