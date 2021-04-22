// -----------------
// Global variables
// -----------------
// codebeat:disable[LOC,ABC,BLOCK_NESTING,ARITY]
const Sequelize = require("sequelize");
const logger = require("./logger");

// -----------------------
// Getting DB Sequelize Instance
// -----------------------
exports.getDbInstance = function ()
{
   console.log("DEBUG: Pre Stage Database Auth Process");
   var newDb;

   // Define what kind of DB it is for Sequelize
   if (process.env.DATABASE_URL.startsWith("postgres"))
   {
      newDb = new Sequelize(process.env.DATABASE_URL, {
         logging: console.log,
         dialectOptions: {
            ssl: {
               require: true,
               rejectUnauthorized: false
            }
         }
      });
   }
   // In other case it's SQLite for now
   else
   {
      newDb = new Sequelize({
         dialect: "sqlite",
         dialectOptions: {
            ssl: {
               require: true,
               rejectUnauthorized: false
            }
         },
         storage: process.env.DATABASE_URL
      });
   }

   // Testing connection before returning db
   TryDbConnection(newDb);
   return newDb;
};

// -----------------------
// Testing a connection to Database
// -----------------------
TryDbConnection = function(db)
{
   // Validate DB Connection
   db.authenticate()
   .then(() =>
   {
      logger("dev","Successfully connected to database");
   })
   .catch(err =>
   {
      logger("error", err);
   });
};

// -----------------------
// Sequelize Models definition (tables in db)
// -----------------------
exports.defineServers = function (db)
{
   console.log("DEBUG: Pre Stage Database server table definition");
   return db.define("servers", {
      id: {
         type: Sequelize.STRING(32),
         primaryKey: true,
         unique: true,
         allowNull: false
      },
      prefix: {
         type: Sequelize.STRING(32),
         defaultValue: "!tr"
      },
      lang: {
         type: Sequelize.STRING(8),
         defaultValue: "en"
      },
      count: {
         type: Sequelize.INTEGER,
         defaultValue: 0
      },
      active: {
         type: Sequelize.BOOLEAN,
         defaultValue: true
      },
      embedstyle: {
         type: Sequelize.STRING(8),
         defaultValue: "on"
      },
      bot2botstyle: {
         type: Sequelize.STRING(8),
         defaultValue: "off"
      },
      webhookid: Sequelize.STRING(32),
      webhooktoken: Sequelize.STRING(255),
      webhookactive: {
         type: Sequelize.BOOLEAN,
         defaultValue: false
      }
   });
};

exports.defineTasks = function (db)
{
   console.log("DEBUG: Pre Stage Database tasks table definition");
   return db.define("tasks", {
      origin: Sequelize.STRING(32),
      dest: Sequelize.STRING(32),
      reply: Sequelize.STRING(32),
      server: Sequelize.STRING(32),
      active: {
         type: Sequelize.BOOLEAN,
         defaultValue: true
      },
      LangTo: {
         type: Sequelize.STRING(8),
         defaultValue: "en"
      },
      LangFrom: {
         type: Sequelize.STRING(8),
         defaultValue: "en"
      }
   },
   {
      indexes: [
         {
            unique: true,
            name: "ux_index_1",
            fields: ["origin", "dest", "LangTo", "LangFrom"]
         }
      ]
   });
};

//---------------------------------------------------------------------------------------------
//-- All this function are for DB init
//---------------------------------------------------------------------------------------------
// -------------------
// Init/create tables
// -------------------
exports.onStartup = async function(db, client, Servers, server_obj)
{
   console.log("DEBUG: Stage Init/create tables - Pre Sync");
   db.sync({ logging: console.log }).then(async() =>
   {
      // Putting DB into newer version if necessary (add columns and so on)
      await upgradeDB(db);
      console.log("DEBUG: New columns should be added Before this point.");

      // Initialize Servers objects
      await initializeServers(client, Servers, server_obj);

      console.log("----------------------------------------\nDatabase fully initialized.\n----------------------------------------");
   });
};

// -----------------------------
// Upgrade DB to new version of RITA
// -----------------------------
upgradeDB = async function(db)
{
   console.log("DEBUG: Checking Missing Variable Columns for old RITA release");
   // For older version of RITA, they need to upgrade DB with adding new columns if needed
   serversDefinition = await db.getQueryInterface().describeTable("servers");
   await addTableColumn("servers", serversDefinition, "prefix", Sequelize.STRING(32), "!tr");
   await addTableColumn("servers", serversDefinition, "embedstyle", Sequelize.STRING(8), "on");
   await addTableColumn("servers", serversDefinition, "bot2botstyle",  Sequelize.STRING(8), "off");
   await addTableColumn("servers", serversDefinition, "webhookid", Sequelize.STRING(32));
   await addTableColumn("servers", serversDefinition, "webhooktoken", Sequelize.STRING(255));
   await addTableColumn("servers", serversDefinition, "webhookactive", Sequelize.BOOLEAN, false);
   console.log("DEBUG: All Columns Checked or Added");
   
   // For older version of RITA, must remove old unique index
   console.log("DEBUG: Stage Remove old RITA Unique index");
   await db.getQueryInterface().removeIndex("tasks", "tasks_origin_dest");
   console.log("DEBUG : All old index removed");
};

// -----------------------------
// Adding a column in DB if not exists
// -----------------------------
addTableColumn = async function(tableName, tableDefinition, columnName, columnType, columnDefault)
{
   // Adding column only when it's not in table definition
   if (!tableDefinition[`${columnName}`])
   {
      console.log("--> Adding " + columnName + " column");
      if (columnDefault === null)
      {
         // Adding column whithout a default value
         await db.getQueryInterface().addColumn(tableName, columnName, {type: columnType});
      }
      else 
      {
         // Adding column with a default value
         await db.getQueryInterface().addColumn(tableName, columnName, {
               type: columnType,
               defaultValue: columnDefault});
      }
   }
};

// -----------------------------
// Initializate "servers" datas 
// -----------------------------
initializeServers = async function(client, Servers, server_obj)
{
   // Getting all servers defined in DB
   const serversFindAll = await Servers.findAll();

   // If table is not initialized, we add a server named bot
   if (serversFindAll.length === 0)
   {
      console.log("DEBUG: Stage Init tables - Adding bot server");
      let botServer = await Servers.create({id: "bot", lang: "en"});
      await botServer.save();
   }

   // Getting all servers datas in server_obj object
   console.log("DEBUG: Stage Init tables - Getting servers from Db");
   for (let i = 0; i < serversFindAll.length; i++)
   {
      // eslint-disable-next-line prefer-const
      let guild_id = serversFindAll[i].id;
      // eslint-disable-next-line eqeqeq
      if (guild_id != "bot")
      {
         server_obj[guild_id] = { db: serversFindAll[i] };
      }
   }

   // Checking that all connected servers are present in DB
   console.log("DEBUG: Stage Init tables - Checking bot servers Vs db Servers");
   const guilds = client.guilds.array().length;
   const guildsArray = client.guilds.array();
   var i;
   for (i = 0; i < guilds; i++)
   {
      const guild = guildsArray[i];
      const guildID = guild.id;
      // If it doesn't exists, we must add the server connected to the bot
      if (!server_obj.hasOwnProperty(guildID))
      {
         console.log("DEBUG: Stage Init tables - Adding server id:" + guildID);
         let connectedServer = await Servers.create({id: guildID, lang: "en"});
         server_obj[guildID] = { db: connectedServer };
         await connectedServer.save();
      }
   }

   // Adding additional information in server_obj (name of the guilde, number of members)
   console.log("DEBUG: Stage Init/create tables - Pre guildClient");
   const guildClient = Array.from(client.guilds.values());
   for (let i = 0; i < guildClient.length; i++)
   {
      const guild = guildClient[i];
      // Adding name of guilde an member count
      server_obj[guild.id].guild = guild;
      server_obj[guild.id].size = guild.memberCount;
      // Update total member Count for all servers
      if (!server_obj.size)
      {
         server_obj.size = 0;
      }
      server_obj.size += guild.memberCount;
   }
};


