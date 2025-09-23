'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require('@iobroker/adapter-core');
const ACTION_SUFFIX = 'action';
const ACTION_ON = 'on';
const ACTION_OFF = 'off';
const ACTION_BRIGHTNESS_UP = 'brightness_move_up';
const ACTION_BRIGHTNESS_DOWN = 'brightness_move_down';
const ACTION_BRIGHTNESS_STOP = 'brightness_stop';

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

		this.dimInterval = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		if (!this.config.rodretId) {
			this.log.error(`Device not configured - please check instance configuration of ${this.namespace}`);
			return;
		}
		if (!this.config.lightId) {
			this.log.error(`Light not configured - please check instance configuration of ${this.namespace}`);
			return;
		}
		if (!this.config.brightnessId) {
			this.log.error(
				`Brightness/Dimmer not configured - please check instance configuration of ${this.namespace}`,
			);
			return;
		}

		this.log.info('RODRET device id: ' + this.config.rodretId);
		this.log.info('RODRET light id: ' + this.config.lightId);
		this.log.info('RODRET brightness id: ' + this.config.brightnessId);

		// subscribe to button action event
		this.log.info(`Subscribing to ${this.rodretAction()}`);
		await this.subscribeForeignStatesAsync(this.rodretAction());
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		this.logit('Unloading adapter...');
		try {
			this.clearDimInterval();

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
			this.logit(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.logit(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.logit(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			if (this.isNonEmptyString(state?.val) && id === this.rodretAction()) {
				await this.handleRodretAction(String(state.val));
			}
		} else {
			// The state was deleted
			this.logit(`state ${id} deleted`);
		}
	}

	/**
	 * Handles actions triggered by the RODRET device.
	 * @param {string} action Any of the allowed RODRET action
	 * states ("onACTION_ON", "off", "brightness_move_up", "brightness_move_down",
	 * "brightness_stop").
	 */
	async handleRodretAction(action) {
		if (this.isNonEmptyString(action) === false) {
			this.log.warn('Ignoring empty action from RODRET device');
			return;
		}
		this.logit(`Handling RODRET action: ${action}`);

		this.clearDimInterval();

		switch (action) {
			case ACTION_ON:
				this.logit(`Switching light ${this.config.lightId} on`);
				this.switchLight(true);
				break;

			case ACTION_OFF:
				this.logit(`Switching light ${this.config.lightId} off`);
				this.switchLight(false);
				break;

			case ACTION_BRIGHTNESS_UP:
				this.logit('Brightening the light');
				this.dimInterval = setInterval(
					() => this.changeBrightness(this.config.dimStep),
					this.config.dimInterval,
				);
				break;

			case ACTION_BRIGHTNESS_DOWN:
				this.logit('Dimming the light');
				this.dimInterval = setInterval(
					() => this.changeBrightness(-this.config.dimStep),
					this.config.dimInterval,
				);
				break;

			case ACTION_BRIGHTNESS_STOP:
				this.clearDimInterval();
				break;

			default:
				this.log.warn(`Unknown action received from RODRET: ${action}`);
				break;
		}
	}

	/**
	 * Clears the dimmer interval if it exists.
	 */
	clearDimInterval() {
		if (this.dimInterval !== null) {
			clearInterval(this.dimInterval);
			this.dimInterval = null;
		}
	}

	/**
	 * @returns {string} The 'action' datapoint ID of the configured RODRET device.
	 */
	rodretAction() {
		return `${this.config.rodretId}.${ACTION_SUFFIX}`;
	}

	/**
	 * @param {boolean} onOrOff
	 */
	async switchLight(onOrOff) {
		if (!this.config.lightId) {
			this.log.error('Light not configured - please check instance configuration');
			return;
		}
		// switch the light on or off
		await this.setForeignStateAsync(this.config.lightId, { val: onOrOff });
	}

	/**
	 * Increase/decrease brightness by delta, keeping within [0, 100].
	 * @param {number} delta - Brightness change (+/-).
	 */
	async changeBrightness(delta) {
		const current = await this.getForeignStateAsync(String(this.config.brightnessId));
		if (!current || current.val === null) {
			this.log.error(`Cannot change brightness - state ${this.config.brightnessId} not found or has no value`);
			return;
		}

		const newBrightness = Math.max(0, Math.min(100, Number(current.val) + delta));
		await this.setForeignStateAsync(String(this.config.brightnessId), { val: newBrightness });

		const isOn = newBrightness > 1;
		await this.switchLight(isOn);
	}

	logit(msg) {
		if (this.config.verbose) this.log.info(msg);
		else this.log.debug(msg);
	}

	/**
	 * Returns true if the input is a string with at least one
	 * non-whitespace character.
	 *
	 * @param {*} value - Any value to check.
	 * @returns {boolean}
	 */
	isNonEmptyString(value) {
		return typeof value === 'string' && value.trim().length > 0;
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
