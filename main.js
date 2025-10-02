'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require('@iobroker/adapter-core');
const RodretDevice = require('./rodretdevice');

class IkeaRodret extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
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

		/** @type {RodretDevice[]} */
		this.devices = [];
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		if (!Array.isArray(this.config.rodretDevices) || this.config.rodretDevices.length === 0) {
			this.log.error(`No devices configured - please check instance configuration of ${this.namespace}`);
			return;
		}

		for (const devConf of this.config.rodretDevices) {
			if (!devConf.rodretId || !devConf.lightId || !devConf.brightnessId) {
				this.log.warn(`Skipping invalid device configuration: ${JSON.stringify(devConf)}`);
				continue;
			}

			// get name of rodret object
			const name = await this._getNameOfObject(devConf.rodretId);
			const device = new RodretDevice(name, this, devConf);
			this.devices.push(device);
			await device.subscribe();

			this.log.info(
				`Configured device: rodret=${devConf.rodretId}, light=${devConf.lightId}, brightness=${devConf.brightnessId}`,
			);
		}
	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		this._logverbose('Unloading adapter...');
		try {
			for (const dev of this.devices) {
				dev._clearDimInterval();
			}

			callback();
		} catch (_e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this._logverbose(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this._logverbose(`object ${id} deleted`);

			this.subscribeForeignStatesAsync;
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (!state) {
			this._logverbose(`state ${id} deleted`);
			return;
		}

		if (!state.val) {
			return;
		}

		this._logverbose(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

		if (typeof state.val === 'string') {
			// find according devuce instance
			const device = this.devices.find((d) => id === d.rodretActionId);
			if (device) {
				await device.handleAction(state.val);
			} else {
				this.log.error(`Received action for unknown device: ${id}`);
			}
		}
	}

	/**
	 * @param {String} objectId Id of object to get the name from
	 */
	async _getNameOfObject(objectId) {
		const data = await this.getForeignObjectAsync(objectId);
		return data?.common?.name || 'UnknUnknownonw';
	}

	_logverbose(msg) {
		if (this.config.verbose) this.log.info(msg);
		else this.log.debug(msg);
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new IkeaRodret(options);
} else {
	// otherwise start the instance directly
	new IkeaRodret();
}
