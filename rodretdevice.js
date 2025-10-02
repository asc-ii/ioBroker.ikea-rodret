const ACTION_SUFFIX = 'action';
const ACTION_ON = 'on';
const ACTION_OFF = 'off';
const ACTION_BRIGHTNESS_UP = 'brightness_move_up';
const ACTION_BRIGHTNESS_DOWN = 'brightness_move_down';
const ACTION_BRIGHTNESS_STOP = 'brightness_stop';

class RodretDevice {
	/**
	 * @param {String} name - Name of the rodret device
	 * @param {IkeaRodret} adapter - Reference to the adapter
	 * @param {ioBroker.AdapterConfig} config - Adapter configueration
	 */
	constructor(name, adapter, config) {
		this.name = name;
		this.adapter = adapter;
		this.config = config;
		this.dimInterval = null;
	}

	/**
	 * @returns {string} The 'action' datapoint ID of the configured RODRET device.
	 */
	get rodretActionId() {
		return `${this.config.rodretId}.${ACTION_SUFFIX}`;
	}

	/**
	 * subscribe to button action event
	 */
	async subscribe() {
		await this.adapter.subscribeForeignStatesAsync(this.rodretActionId);
		this.adapter.log.info(`${this.name}: Subscribed to ${this.rodretActionId}`);
	}

	/**
	 * Handles actions triggered by the RODRET device.
	 * @param {string} action Any of the allowed RODRET action
	 * states ("onACTION_ON", "off", "brightness_move_up", "brightness_move_down",
	 * "brightness_stop").
	 */
	async handleAction(action) {
		if (!this._isNonEmptyString(action)) {
			this.adapter.log.warn(`${this.name}: Ignoring empty action from RODRET device`);
			return;
		}

		this.adapter.log.debug(`${this.name}: Handling action ${action} for device ${this.config.rodretId}`);
		this._clearDimInterval();

		switch (action) {
			case ACTION_ON:
				await this._switchLight(true);
				break;

			case ACTION_OFF:
				await this._switchLight(false);
				break;

			case ACTION_BRIGHTNESS_UP:
				this.dimInterval = setInterval(
					() => this._changeBrightness(this.config.dimStep),
					this.config.dimInterval,
				);
				break;

			case ACTION_BRIGHTNESS_DOWN:
				this.dimInterval = setInterval(
					() => this._changeBrightness(-this.config.dimStep),
					this.config.dimInterval,
				);
				break;

			case ACTION_BRIGHTNESS_STOP:
				this._clearDimInterval();
				break;

			default:
				this.adapter.log.warn(`${this.name}: Unknown action received from RODRET: ${action}`);
				break;
		}
	}

	/**
	 * Clears the dimmer interval if it exists.
	 */
	_clearDimInterval() {
		if (this.dimInterval !== null) {
			clearInterval(this.dimInterval);
			this.dimInterval = null;
		}
	}

	/**
	 * @param {boolean} onOrOff
	 */
	async _switchLight(onOrOff) {
		if (!this.config.lightId) {
			// usuably should not happen...
			this.adapter.log.error(`${this.name}: Light not configured - please check instance configuration`);
			return;
		}
		await this.adapter.setForeignStateAsync(this.config.lightId, { val: onOrOff });
	}

	/**
	 * Increase/decrease brightness by delta, keeping within [0, 100].
	 * @param {number} delta - Brightness change (+/-).
	 */
	async _changeBrightness(delta) {
		const current = await this.adapter.getForeignStateAsync(String(this.config.brightnessId));
		if (!current || current.val === null) {
			this.adapter.log.error(
				`${this.name}: Cannot change brightness - state ${this.config.brightnessId} not found or has no value`,
			);
			return;
		}

		const newBrightness = Math.max(0, Math.min(100, Number(current.val) + delta));
		await this.adapter.setForeignStateAsync(String(this.config.brightnessId), { val: newBrightness });

		const isOn = newBrightness > 1;
		await this._switchLight(isOn);
	}

	/**
	 * Returns true if the input is a string with at least one
	 * non-whitespace character.
	 *
	 * @param {*} value - Any value to check.
	 * @returns {boolean}
	 */
	_isNonEmptyString(value) {
		return typeof value === 'string' && value.trim().length > 0;
	}
}

module.exports = RodretDevice;
