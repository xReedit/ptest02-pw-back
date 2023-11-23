var config = {};

config.database = process.env.DB_NAME || 'restobar';
config.username = process.env.DB_USER || 'resto';
config.password = process.env.DB_PASSWORD ||'182182';

config.db_host= process.env.DB_HOST || "192.168.1.65";
config.db_port= process.env.DB_PORT || 3306;

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

module.exports = config;