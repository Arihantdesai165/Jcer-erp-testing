import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';

class GoogleDriveIntegration extends Model {
  public id!: string;
  public accountEmail!: string;
  public accountName!: string | null;
  public encryptedRefreshToken!: string;
  public accessToken!: string | null;
  public tokenExpiry!: Date | null;
  public scope!: string;
  public rootFolderId!: string | null;
  public rootFolderName!: string;
  public status!: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';
  public autoBackupEnabled!: boolean;
  public connectedById!: string | null;
  public readonly connectedBy?: User;
  public lastSyncAt!: Date | null;
  public lastError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GoogleDriveIntegration.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    accountEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    accountName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    encryptedRefreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scope: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: 'https://www.googleapis.com/auth/drive.file',
    },
    rootFolderId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rootFolderName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'JCER ERP Attendance',
    },
    status: {
      type: DataTypes.ENUM('CONNECTED', 'DISCONNECTED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'DISCONNECTED',
    },
    autoBackupEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    connectedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'google_drive_integrations',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['accountEmail'] },
    ],
  }
);

GoogleDriveIntegration.belongsTo(User, { as: 'connectedBy', foreignKey: 'connectedById' });

export default GoogleDriveIntegration;
