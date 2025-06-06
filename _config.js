let _config;
try {
	_config = require('./config');
} catch(e) {
	_config = {
		port: '',
		portSocket: '',
		database: '',
		username: '',
		password: '',
		db_host: '',
		port: '',
		db_port: '',
		publicKeyVapid: '',
		privateKeyVapid: '',
		firebaseApikey: ''
	};
}


var config = {};

config.port = process.env.PORT || _config?.port;
config.portSocket = process.env.PORT_SOCKET || _config?.portSocket;

config.database = process.env.DB_NAME || _config?.database;
config.username = process.env.DB_USER || _config?.username;
config.password = process.env.DB_PASSWORD || _config?.password;

config.db_host= process.env.DB_HOST || _config?.db_host;
config.db_port= process.env.DB_PORT || _config?.db_port;

config.publicKeyVapid = process.env.PB_VAPID  || _config?.publicKeyVapid;
config.privateKeyVapid = process.env.PV_VAPID || _config?.privateKeyVapid;
config.firebaseApikey = process.env.FB_API || _config?.firebaseApikey;

config.dialect="mysql";
config.operatorsAliases = false;

config.sequelizeOption = { 
        host:config.db_host, 
        dialect:"mysql",
        port: config.db_port,        
        dialectOptions: {
		   multipleStatements: true		  
		},
		// operatorsAliases: false, timezone: "America/Lima",
        operatorsAliases: false, timezone: "-05:00",
                define: {
                        underscored: true,
                        timestamps: false
                },
                logging: false
        }

config.SEED = process.env.SEED || _config.SEED;
config.SEED_SMS = process.env.SEED_SMS || _config.SEED_SMS;
config.accountSidSms = 'ACcff65068f1953949a1458c1b1333dbd2';
config.authTokenSms = 'a8f1b4ce53a6be87272ecd9ca33f616b';

config.SEED_EMAIL = process.env.SEED_EMAIL || _config.SEED_EMAIL;
config.SEED_SES_USER = process.env.SEED_SES_USER || _config.SEED_SES_USER;
config.SEED_SES_PASS = process.env.SEED_SES_PASS || _config.SEED_SES_PASS;

config.URL_BOT_GPT = '';


module.exports = config;