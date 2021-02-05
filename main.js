'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");

class GeofenceAdv extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'geofence-adv',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		
		this.log.info("Adapter got 'Ready' Signal - initiating functions...");
		
		await this.createUserGroupIfNotExists(this.config.userGroupName, this.config.userName, this.config.userPassword);
		
		// Try to start Webserver
		if (this.config.activate_server) {
			if (this.config.ssl) {
				// subscribe on changes of permissions
				this.subscribeForeignObjects('system.group.*');
				this.subscribeForeignObjects('system.user.*');
	
				if (!this.config.certPublic) {
					this.config.certPublic = 'defaultPublic';
				}
				if (!this.config.certPrivate) {
					this.config.certPrivate = 'defaultPrivate';
				}
	
				// Load certificates
				this.getForeignObject('system.certificates', function (err, obj) {
					if (err || !obj || !obj.native.certificates || !this.config.certPublic || !this.config.certPrivate || !obj.native.certificates[this.config.certPublic] || !obj.native.certificates[this.config.certPrivate]
					) {
						this.log.error('Cannot enable secure web server, because no certificates found: ' + this.config.certPublic + ', ' + this.config.certPrivate);
					} else {
						this.log.debug('ertificates found: ' + this.config.certPublic + ', ' + this.config.certPrivate);
						this.config.certificates = {
							key: obj.native.certificates[this.config.certPrivate],
							cert: obj.native.certificates[this.config.certPublic]
						};
					}
					this.initWebServer();
				}.bind(this) );
			} else {
				this.initWebServer();
			}
		}
		
		this.subscribeStates('USERS.*.DEVICES.*.BUILDINGS.*.devicePresence');

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//this.log.info('config SSL: ' + this.config.ssl);
		//this.log.info('config Port: ' + this.config.port);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		/*await this.setObjectNotExistsAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync('testVariable', { val: true, ack: true });
		
		//let get = await this.getStateAsync('testVariable');
		//this.log.info(get.val);

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//let result = await this.checkPasswordAsync('admin', 'iobroker');
		//this.log.info('check user admin pw iobroker: ' + result);

		//result = await this.checkGroupAsync('admin', 'admin');
		//this.log.info('check group user admin group admin: ' + result);
	}
	
	async createUserGroupIfNotExists(userGroupName, userName, userPassword) {
		
		let group = await this.getForeignObjectAsync('system.group.'+userGroupName );
		if (group) {
			this.log.debug('Usergroup "'+userGroupName +'" already exists!');
			this.createUserIfNotExists(userName, userPassword, userGroupName);
		} else {
			let obj = {
				'type': 'group',
				'native': {},
				'common':{
					'name':userGroupName,
					'desc':'',
					'members':[],
					'acl':{
						'object':{
							'read':true,
							'list':true,
							'write':false,
							'delete':false
						},
						'state':{
							'read':true,
							'list':true,
							'write':true,
							'delete':false,
							'create':true
						},
						'users':{
							'write':false,
							'delete':false,
							'create':false
						},
						'other':{
							'http':true,
							'execute':false,
							'sendto':false
						},
						'file': {
							'read':true,
							'list':true,
							'write':false,
							'delete':false,
							'create':false
						}
					},
					'icon':'',
					'color':false,
					'id':'userGroupName'
				}
			};
			
			this.setForeignObject('system.group.'+userGroupName, obj, function (err) {
				if (err) {
					this.log.error('Cannot write object for state [' + 'system.group.'+userGroupName + ']: ' + err);
				} else {
					this.log.warn('Usergroup "'+userGroupName +'" was created. >>> Please assign User to this Usergroup! <<<');
					this.createUserIfNotExists(userName, userPassword, userGroupName);
				}
			}.bind(this));
		}
	}
	
	async createUserIfNotExists(userName, userPassword, userGroupName) {
		let user = await this.getForeignObjectAsync('system.user.'+userName );
		if (user) {
			this.log.debug('User "'+userName +'" already exists!');
			this.assignUserToGroupe(userName, userGroupName);
		} else {
			let obj = {
				'type':'user',
				'native':{},
				'common':{
					'name':userName,
					'icon':'',
					'color':false,
					'desc':'Password: '+ userPassword,
					'enabled':true
				}
			};
			
			this.setForeignObject('system.user.'+userName, obj, async function (err) {
				if (err) {
					this.log.error('Cannot write object for state [' + 'system.user.'+userName + ']: ' + err);
				} else {
					this.log.warn('User "'+userName +'" was created!');
					this.setPassword(userName, userPassword);
					this.assignUserToGroupe(userName, userGroupName);
				}
			}.bind(this));
		}
	}
	
	async assignUserToGroupe(userName, userGroupName) {
		let group = await this.getForeignObjectAsync('system.group.'+userGroupName );
		this.log.debug(JSON.stringify(group.common.members));
		if (group) {
			if (group.common.members.includes("system.user."+userName)) {
				this.log.debug('Usergroup "'+userGroupName +'" allready assign to User "'+userName+'"!');
			} else {
				group.common.members.push('system.user.'+userName);
				this.extendForeignObject('system.group.'+userGroupName, {'common': {'members': group.common.members}});
				this.log.info('Usergroup "'+userGroupName +'" was assign to User "'+userName+'"!');
			}
		} else {
			this.log.error('Usergroup "'+userGroupName +'" does not extist!');
		}
	}

	initWebServer() {
		if (this.config.port) {
			if (this.config.ssl) {
				if (!this.config.certificates) {
					this.log.error('No SSL Certificate avaiable!');
					process.exit(1);
				} else {
					this.webserver = require('https').createServer(this.config.certificates, this.requestProcessor.bind(this));
				}
			} else {
				this.webserver = require('http').createServer(this.requestProcessor.bind(this));
			}
		} else {
			this.log.error('port missing');
			process.exit(1);
		}
		
		if (this.webserver) {
			this.getPort(this.config.port, function (port) {
				if (port != this.config.port && !this.config.findNextPort) {
					this.log.error('port ' + this.config.port + ' already in use');
					process.exit(1);
				}
				this.webserver.listen(port);
				this.log.info('http' + (this.config.ssl ? 's' : '') + ' server listening on port ' + port);
			}.bind(this));
		}
		
		if (!this.webserver) {
			this.log.error('Error starting Webserver');
			process.exit(1);
		}
	}
	
	async requestProcessor(req, res) {
		this.log.debug('Request received with headers: ' + JSON.stringify(req.headers));
		
		var http_auth = req.headers['authorization']; //req.headers.authorization;  // auth is in base64(username:password)  so we need to decode the base64
		if (http_auth) {
			this.log.debug("Authorization Header is: " + http_auth);
			let [username, password] = new Buffer(http_auth.split(' ')[1], 'base64').toString().split(':');
			this.log.debug("Decoded Username: " + username);
			this.log.debug("Decoded Password: " + password);
			
			http_auth = await this.checkPasswordAsync(username, password) && await this.checkGroupAsync(username, this.config.userGroupName);
			
			if (!http_auth) {
				this.log.warn("User credentials invalid");
				res.statusCode = 403;
				res.end();
				return;
			} else {
				this.log.debug('User [' + username+'] successfully logged in (http-basic-auth)!');
			}
		}
		
		if (req.method === 'POST') {
			var body = '';
			this.log.debug("request [POST] path:" + req.url);
	
			req.on('data', function (chunk) {
				body += chunk;
			});
	
			req.on('end', async function () {
				var params = req.url.substring(1).split('/');
	
				if (http_auth !== true  && params.length >= 4) {
					http_auth = await this.checkPasswordAsync(params[0], params[1]) && await this.checkGroupAsync(params[0], this.config.userGroupName);
					if (!http_auth) {
						this.log.warn("User credentials invalid");
						res.statusCode = 403;
						res.end();
						return;
					} else {
						this.log.debug('User [' + params[0] + '] successfully logged in (http-url)!');
						params.shift();
						params.shift();
					}
				}
	
				if (http_auth && params.length >= 3) {
					var [ objUser, deviceName, objType ] = params;
					objType = objType.toUpperCase();
										
					// APP: GEOFENCY	Methode: POST	Format: JSON
					if (req.headers['user-agent'].includes('Geofency') && req.headers['content-type'].includes('application/json')) {
						this.relayRequest(
							req.url,
							req.headers,
							body,
							true
						);
						
						let jbody = JSON.parse(body);
						this.log.info('Request from APP: [Geofency POST JSON]');
						await this.handleWebhookRequest(objUser, objType, deviceName, jbody);
						
					// APP: GEOFENCY	Methode: POST	Format: HTML	
					} else if (req.headers['user-agent'].includes('Geofency') && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
						this.relayRequest(
							req.url,
							req.headers,
							body,
							false
						);
						const querystring = require('querystring');
						let jbody = querystring.decode(body);
						this.log.info('Request from APP: [Geofency POST HTML]');
						await this.handleWebhookRequest(objUser, objType, deviceName, jbody);
					
					// APP: LOCATIV		Methode: POST	Format: HMTL
					} else if (req.headers['user-agent'].includes('Locative') && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
						this.relayRequest(
							req.url,
							req.headers,
							body,
							false
						);

						const querystring = require('querystring');
						let temp = querystring.decode(body);
						
						let jbody = {
							'id': temp.device,
							'name': temp.id,
							'entry': (temp.trigger =='enter' ? '1' : '0'),
							'date': Math.round(temp.timestamp*1000),
							'currentLatitude': temp.latitude,	
							'currentLongitude': temp.longitude,	
						};
						this.log.info('Request from APP: [Locative POST HTML]');
						await this.handleWebhookRequest(objUser, objType, deviceName, jbody);

						
					// Unknown APP
					} else{
						this.log.warn('Unknown Request from APP: '+ JSON.stringify(req.headers));
						this.log.warn(body);
						res.writeHead(500);
						res.write("Request error");
						res.end();
						return;
					}
					res.writeHead(200);
					res.write("OK");
					res.end();
					return;
				} else {
					res.writeHead(500);
					res.write("Request error");
					res.end(); 
					return;
				}
				
			}.bind(this));
		} else {
			res.writeHead(500);
			res.write("Request error");
			res.end();
			return;
		}
	}
	
	relayRequest(url, headers, body, json=true) {
		if (this.config.activate_relay) {
			
			
			delete headers.host;
			delete headers['content-length'];
			
			if (json) {
				body = JSON.parse(body);
			}
			
			var request = require('request');
			try {
				this.log.info('Relay request to: '+this.config.relayServer + url);
				request.post(
					{
						url: this.config.relayServer + url,
						method: 'POST',
						body: body,
						headers: headers,
						json: json
					}
				);
			} catch(err) {
				this.log.error('Error ['+err+'] during relaying request to: '+this.config.relayServer + url);
			}
			
		}		
	}
	
	async handleWebhookRequest(objUser, objType, deviceName, jbody) {
		jbody.name = jbody.name.split(':');
		jbody.names = [];
		var treename = '';
		for (var i=0; i<jbody.name.length ;i++) {
			jbody.name[i] = jbody.name[i].replace(/\s/g, '_');
			treename = treename + (treename =='' ? '' : '.')+jbody.name[i];
			jbody.names.push(treename);
		}
		
		var data = {
			'user' : {
				'name'	: objUser
			},
			'device' : {
				'name': deviceName,
				'id': jbody.device,
				'lat': jbody.currentLatitude,
				'long': jbody.currentLongitude,
				'wifi_ssid': jbody.wifiSSID,
				'wifi_mac': jbody.wifiBSSID,
				'date': this.formatDate(new Date(jbody.date), "YYYY-MM-DD hh:mm:ss"),
				'presence': (jbody.entry == '1' ? true : false),
				'motion': jbody.motion
			},
			'object' : {
				'name': jbody.name[0],
				'tree': jbody.name,
				'treenames': jbody.names,
				'type': objType,
				'lat': jbody.latitude,
				'long': jbody.longitude,
				'radius': jbody.radius,
				'address': jbody.address,
				'beaconUUID': jbody.beaconUUID,
				'beaconMinor': jbody.minor,
				'beaconMajor': jbody.major
			}
		}

		this.log.debug(JSON.stringify(data));
		if (this.config.create) {
			await this.createStateVariables(data);
		}
		
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Position.lat', data.device.lat);
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Position.long', data.device.long);
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Position.latlong', data.device.lat + ';' + data.device.long);
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Position.motion', data.device.motion);
		// ON: address
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Informations.WiFi_SSID', data.device.wifi_ssid);
		await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.Informations.WiFi_MAC', data.device.wifi_mac);

		let changed = await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.' + data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.devicePresence', data.device.presence);
		if (changed) {
			await this.setStateIfChanged('USERS.' + data.user.name + '.DEVICES.' + data.device.name + '.' + data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.device'+(data.device.presence === true ? 'LastEnter' : 'LastLeave'), data.device.date);
		}
		
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.Position.lat', data.object.lat);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.Position.long', data.object.long);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.Position.latlong', data.object.lat + ';' + data.object.long);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.Position.radius', data.object.radius);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.Position.address', data.object.address);
		
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.BEACON.uuid', data.object.beaconUUID);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.BEACON.major', data.object.beaconMajor);
		await this.setStateIfChanged(data.object.type + '.' + data.object.treenames.slice(-1)[0] + '.BEACON.minor', data.object.beaconMinor);
	}

	async setStateIfChanged(id,value) {
		try {
			this.log.debug('Write State: '+ id + ' -> '+value);
			let old = await this.getStateAsync(id);
			if (old == null || old.val != value) {
				this.setState(id, {val: value, ack: true});
				return true;
			} else {
				return false;
			}
		}
		catch (e) {
		   this.log.error(e);
		   return false;
		}
	}
	
	async createStateVariables(data) {
		let userName = data.user.name;
		let deviceId = data.device.name;
		let typeName = data.object.type;
		
		await this.setObjectNotExistsAsync('USERS', {
			type: 'channel',
			common: {
				name: 'USERS'
			},
			native: {}
		});
			await this.setObjectNotExistsAsync('USERS.'+userName, {
				type: 'device',
				common: {
					name: userName
				},
				native: {}
			});
				await this.setObjectNotExistsAsync('USERS.'+userName+'.Config', {
					type: 'channel',
					common: {
						name: 'Config'
					},
					native: {}
				});
					await this.setObjectNotExistsAsync('USERS.'+userName+'.Config.primaryDevice', {
						type: 'state',
						common: {
							name: 'Primärer Device Pfad',
							type: 'string',
							read: true,
							write: true
						},
						native: {}
					});
				
				await this.createPositionStates('USERS.'+userName);
				await this.createPresenceStates('USERS.'+userName, 'user');
				
				await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES', {
					type: 'channel',
					common: {
						name: 'DEVICES'
					},
					native: {}
				});
					let first_device = await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId, {
						type: 'device',
						common: {
							name: deviceId
						},
						native: {}
					});
						if (first_device) {
							this.setState('USERS.'+userName+'.Config.primaryDevice', {val: 'USERS.'+userName+'.DEVICES.'+deviceId, ack: false});
							this.log.info('Primary Device set to: "' + 'USERS.'+userName+'.DEVICES.'+deviceId + '"');
						}
						//await this.createPresenceStates('USERS.'+userName+'.DEVICES.'+deviceId, 'device');
						
						await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId+'.'+ typeName, {
							type: 'channel',
							common: {
								name: typeName
							},
							native: {}
						});
						
						for (var i=0; i<data.object.tree.length ;i++) {
							await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId+'.'+ typeName+'.'+data.object.treenames[i], {
								type: 'device',
								common: {
									name: data.object.tree[i]
								},
								native: {}
							});
							await this.createPresenceStates('USERS.'+userName+'.DEVICES.'+deviceId+'.'+ typeName+'.'+data.object.treenames[i], 'device');
						}

						await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId+'.Informations', {
							type: 'channel',
							common: {
								name: 'Informationen'
							},
							native: {}
						});
							await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId+ '.Informations.WiFi_SSID', {
								type: 'state',
								common: {
									name: 'WiFi SSID',
									type: 'string',
									read: true,
									write: true
								},
								native: {}
							});
							await this.setObjectNotExistsAsync('USERS.'+userName+'.DEVICES.'+deviceId+ '.Informations.WiFi_MAC', {
								type: 'state',
								common: {
									name: 'WiFi MAC-Adresse',
									type: 'string',
									read: true,
									write: true
								},
								native: {}
							});
						await this.createPositionStates('USERS.'+userName+'.DEVICES.'+deviceId);
		
		await this.setObjectNotExistsAsync(typeName, {
			type: 'channel',
			common: {
				name: typeName
			},
			native: {}
		});
		
		for (var i=0; i<data.object.tree.length ;i++) {
			await this.setObjectNotExistsAsync(typeName+'.'+data.object.treenames[i], {
				type: 'device',
				common: {
					name: data.object.tree[i]
				},
				native: {}
			});
			await this.createPositionStates(typeName+'.'+data.object.treenames[i]);
			// DELETE MOTION
			await this.setObjectNotExistsAsync(typeName+'.'+data.object.treenames[i] +'.Position.radius', {
				type: 'state',
				common: {
					name: 'Radius',
					type: 'number',
					read: true,
					write: true
				},
				native: {}
			});
			await this.createPresenceCountStates(typeName+'.'+data.object.treenames[i]);
			await this.createBeaconStates(typeName+'.'+data.object.treenames[i]);
			
			//await this.createPresenceStates(typeName+'.'+data.object.treenames[i], 'device');
		}
	}
	
	async createBeaconStates(path) {
		await this.setObjectNotExistsAsync(path+'.BEACON', {
			type: 'channel',
			common: {
				name: 'iBeacon'
			},
			native: {}
		});
			await this.setObjectNotExistsAsync(path + '.BEACON.uuid', {
				type: 'state',
				common: {
					name: 'iBeacon UUID',
					type: 'string',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path + '.BEACON.minor', {
				type: 'state',
				common: {
					name: 'iBeacon Minor',
					type: 'number',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path + '.BEACON.major', {
				type: 'state',
				common: {
					name: 'iBeacon Major',
					type: 'number',
					read: true,
					write: true
				},
				native: {}
			});
	}
	
	async createPresenceCountStates(path) {
		await this.setObjectNotExistsAsync(path + '.presence', {
			type: 'state',
			common: {
				name: 'Anwesenheit',
				type: 'boolean',
				read: true,
				write: true
			},
			native: {}
		});
		await this.setObjectNotExistsAsync(path + '.presenceCount', {
			type: 'state',
			common: {
				name: 'Personenanzahl anwesend',
				type: 'number',
				read: true,
				write: true
			},
			native: {}
		});
		await this.setObjectNotExistsAsync(path + '.presenceUsers', {
			type: 'state',
			common: {
				name: 'Personen anwesend',
				type: 'object',
				read: true,
				write: true
			},
			native: {}
		});
	}
	
	async createPresenceStates(path, type) {
		await this.setObjectNotExistsAsync(path + '.' + type + 'Presence', {
			type: 'state',
			common: {
				name: 'Anwesenheit',
				type: 'boolean',
				read: true,
				write: true
			},
			native: {}
		});
		await this.setObjectNotExistsAsync(path + '.' + type + 'LastEnter', {
			type: 'state',
			common: {
				name: 'Zuletzt angekommen',
				type: 'string',
				read: true,
				write: true
			},
			native: {}
		});
		await this.setObjectNotExistsAsync(path + '.' + type + 'LastLeave', {
			type: 'state',
			common: {
				name: 'Zuletzt verlassen',
				type: 'string',
				read: true,
				write: true
			},
			native: {}
		});
	}
	
	async createPositionStates(path) {
		await this.setObjectNotExistsAsync(path+'.Position', {
			type: 'channel',
			common: {
				name: 'Position'
			},
			native: {}
		});
			await this.setObjectNotExistsAsync(path+'.Position.lat', {
				type: 'state',
				common: {
					name: 'Latitude',
					type: 'number',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path+'.Position.long', {
				type: 'state',
				common: {
					name: 'Longitude',
					type: 'number',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path+'.Position.latlong', {
				type: 'state',
				common: {
					name: 'Latitude;Longitude',
					type: 'string',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path+'.Position.address', {
				type: 'state',
				common: {
					name: 'Adresse',
					type: 'string',
					read: true,
					write: true
				},
				native: {}
			});
			await this.setObjectNotExistsAsync(path+'.Position.motion', {
				type: 'state',
				common: {
					name: 'Bewegung',
					type: 'string',
					read: true,
					write: true
				},
				native: {}
			});
	}
	
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			this.log.info("Terminating Webserver [http" + (this.config.ssl ? "s" : "") + "] server on port " + this.config.port);
			
			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
			
			switch(id.split('.').slice(-1)[0]) {
				case 'devicePresence':
					this.log.debug('ON->Changed: "devicePresence"');
					this.onStateChange_devicePresence(id, state);
					
					break;
				default:
					// code block
					break;
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
	
	async onStateChange_devicePresence(id, state) {
		let device_path = id.split('.').slice(2,6).join('.');
		let user_path = id.split('.').slice(2,4).join('.');
		let type_path = id.split('.').slice(6,-1).join('.');
		let default_device = await this.getStateAsync(user_path+'.Config.primaryDevice');
		
		if (default_device && default_device.val == device_path ) {
			this.log.debug('ON->Changed: "devicePresence" from: Default device');
			
			this.getStates(
				'USERS.*.Config.primaryDevice',
				async (err, states) => {
					
					var users = [];
					var count = 0;
										
					for (var key in states) {
						let presence = await this.getStateAsync(states[key].val + '.' + type_path + '.devicePresence');
						if (presence !== null && presence.val == true) {
							let userName = key.split('.').slice(3,4).join('');
							count++;
							users.push(userName);
						}
					}
					
					this.setState(type_path+'.presence',(count>0 ? true : false));
					this.setState(type_path+'.presenceCount',count);
					this.setState(type_path+'.presenceUsers',users);
					
					this.log.info('Präsenz in "' + type_path + '" aktualisiert.');
				}
			);
		}
		
		
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new GeofenceAdv(options);
} else {
	// otherwise start the instance directly
	new GeofenceAdv();
}