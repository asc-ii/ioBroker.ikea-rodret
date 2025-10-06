'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require('@iobroker/adapter-core');
const RodretDevice = require('./rodretdevice');
const LightDevice = require('./lightdevice');

class IkeaRodret extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options] ioBroker Adapter options.
     */
    constructor(options) {
        super({
            ...options,
            name: 'ikea-rodret',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('unload', this.onUnload.bind(this));

        this.deviceMap = new Map();
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        if (!Array.isArray(this.config.devices) || this.config.devices.length === 0) {
            this.log.error(`No devices configured - please check instance configuration of ${this.namespace}`);
            return;
        }

        const rodretDevices = new Map();

        /** Cache of initialized lights */
        const lightDevices = new Map();

        /** Keeps track of rodret-light pairs to prevent duplicates */
        const seenMappings = new Set();

        for (const { rodretId, lightId } of this.config.devices) {
            if (!rodretId || !lightId) {
                this.log.warn(`Skipping invalid device config: ${JSON.stringify({ rodretId, lightId })}`);
                continue;
            }

            // ...just to track duplicate device-light mappings
            const pairKey = `${rodretId}::${lightId}`;
            if (seenMappings.has(pairKey)) {
                this.log.warn(`Duplicate mapping ${pairKey} — skipping.`);
                continue;
            }
            seenMappings.add(pairKey);

            try {
                // Initialize or reuse the RodretDevice
                let rodret = rodretDevices.get(rodretId);
                if (!rodret) {
                    rodret = new RodretDevice(this, rodretId);
                    await rodret.init();
                    await rodret.subscribe();
                    rodretDevices.set(rodretId, rodret);
                }

                // Initialize or reuse the LightDevice
                let light = lightDevices.get(lightId);
                if (!light) {
                    light = new LightDevice(this, lightId);
                    await light.init();
                    lightDevices.set(lightId, light);
                }

                // Attach the light to the rodret
                rodret.addLight(light);

                this.log.debug(`Linked RODRET ${rodretId} -> Light ${lightId}`);
            } catch (err) {
                this.log.error(`Failed to initialize RODRET ${rodretId} or Light ${lightId}: ${err.message}`);
            }
        }

        if (rodretDevices.size === 0) {
            this.log.warn('No valid RODRET devices configured — adapter will remain idle.');
            return;
        }

        // Register all rodrets in deviceMap for state event handling
        this.deviceMap = new Map([...rodretDevices.values()].map(device => [device.rodretActionId, device]));

        this.log.info(
            `Adapter initialized with ${rodretDevices.size} RODRET devices controlling ${
                seenMappings.size
            } unique light mappings.`,
        );
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback The callback function has to be called under any circumstances.
     */
    onUnload(callback) {
        this.log.debug('Unloading adapter...');
        try {
            callback();
        } catch (_e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     *
     * @param {string} id ID of object that changed.
     * @param {ioBroker.Object | null | undefined} obj The object that changed (or null if it was deleted).
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.debug(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.debug(`object ${id} deleted`);

            this.subscribeForeignStatesAsync;
        }
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id ID of state that changed.
     * @param {ioBroker.State | null | undefined} state The state that changed (or null if it was deleted).
     */
    async onStateChange(id, state) {
        if (!state) {
            this.log.debug(`state ${id} deleted`);
            return;
        }

        if (!state.val) {
            return;
        }

        this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

        // find according device instance
        const device = this.deviceMap.get(id);
        if (device && typeof state.val === 'string') {
            await device.handleAction(state.val);
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options] ioBroker Adapter options.
     */
    module.exports = options => new IkeaRodret(options);
} else {
    // otherwise start the instance directly
    new IkeaRodret();
}
