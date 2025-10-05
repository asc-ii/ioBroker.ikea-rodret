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

        // for now we want to ensure that a rodret device is used only once
        // and same for a light
        const usedRodretIds = new Set();
        const usedLightIds = new Set();

        this.log.debug(`Config devices: ${JSON.stringify(this.config.devices)}`);

        for (const devConf of this.config.devices) {
            try {
                if (!devConf.rodretId || !devConf.lightId) {
                    this.log.warn(`Skipping invalid device configuration: ${JSON.stringify(devConf)}`);
                    continue;
                }
                if (devConf.rodretId === !devConf.lightId) {
                    this.log.error(`RODRET and light id must not be same. Skipping invalid device configuration.`);
                    continue;
                }

                // Duplicate checks
                if (usedRodretIds.has(devConf.rodretId)) {
                    this.log.error(`RODRET device ${devConf.rodretId} is configured multiple times! Skipping.`);
                    continue;
                }
                if (usedLightIds.has(devConf.lightId)) {
                    this.log.error(`Light ${devConf.lightId} is already controlled by another RODRET! Skipping.`);
                    continue;
                }

                // create LightDevice instance and validate
                const light = new LightDevice(this, devConf.lightId);
                await light.init();

                // Create and register device instance
                const device = new RodretDevice(this, devConf.rodretId, light);
                await device.init();
                await device.subscribe();

                this.deviceMap.set(device.rodretActionId, device);

                // remember used ids for duplicate checks
                usedRodretIds.add(devConf.rodretId);
                usedLightIds.add(devConf.lightId);

                this.log.info(
                    `Configured device '${device.name}': rodret=${devConf.rodretId}, light=${devConf.lightId}`,
                );
            } catch (err) {
                this.log.error(`Skipping device config ${JSON.stringify(devConf)}: ${err.message}`);
            }
        }

        if (this.deviceMap.size === 0) {
            this.log.warn('No valid devices configured after validation, adapter will be idle.');
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param {() => void} callback The callback function has to be called under any circumstances.
     */
    onUnload(callback) {
        this.log.debug('Unloading adapter...');
        try {
            for (const dev of this.deviceMap.values()) {
                dev._clearDimInterval();
            }

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
