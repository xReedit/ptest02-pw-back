/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('usuario', {
    idusuario: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    idorg: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
      references: {
        model: 'org',
        key: 'idorg'
      }
    },
    idsede: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
      references: {
        model: 'sede',
        key: 'idsede'
      }
    },
    nombres: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    usuario: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      get() { return ':)'; }
    },
    estado: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: '0'
    }
  }, {
    tableName: 'usuario'
  });
};
