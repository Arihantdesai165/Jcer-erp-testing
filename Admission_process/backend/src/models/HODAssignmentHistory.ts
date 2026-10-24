import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';
import HOD from './HOD';

class HODAssignmentHistory extends Model {
  public id!: string;
  public hodId!: string | null;
  public userId!: string;
  public departmentId!: string;
  public academicYear!: string;
  public startDate!: Date;
  public endDate!: Date | null;
  public status!: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED';
  public assignedByUserId!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

HODAssignmentHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    hodId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'hods',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'SUSPENDED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    assignedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize: db,
    tableName: 'hod_assignment_histories',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['departmentId'] },
      { fields: ['academicYear'] },
      { fields: ['status'] },
    ],
  }
);

HODAssignmentHistory.belongsTo(User, { as: 'user', foreignKey: 'userId' });
HODAssignmentHistory.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
HODAssignmentHistory.belongsTo(HOD, { as: 'hod', foreignKey: 'hodId' });
HODAssignmentHistory.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedByUserId' });

export default HODAssignmentHistory;
