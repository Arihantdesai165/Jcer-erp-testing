import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AssessmentConfiguration from './AssessmentConfiguration';
import User from './User';

export type ReviewActionType =
  | 'SUBMITTED'
  | 'RETURNED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'PUBLISHED';

class AssessmentReviewHistory extends Model {
  public id!: string;
  public assessmentConfigurationId!: string;
  public action!: ReviewActionType;
  public fromStatus!: string | null;
  public toStatus!: string;
  public actorId!: string | null;
  public actorRole!: string;
  public actorName!: string | null;
  public comments!: string | null;
  public metadata!: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public assessmentConfiguration?: AssessmentConfiguration;
  public actor?: User;
}

AssessmentReviewHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'assessment_configurations',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fromStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    actorRole: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'FACULTY',
    },
    actorName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize: db,
    tableName: 'assessment_review_history',
    timestamps: true,
    indexes: [
      { fields: ['assessmentConfigurationId'] },
      { fields: ['actorId'] },
      { fields: ['action'] },
    ],
  }
);

AssessmentReviewHistory.belongsTo(AssessmentConfiguration, {
  as: 'assessmentConfiguration',
  foreignKey: 'assessmentConfigurationId',
});
AssessmentReviewHistory.belongsTo(User, { as: 'actor', foreignKey: 'actorId' });
AssessmentConfiguration.hasMany(AssessmentReviewHistory, {
  as: 'reviewHistory',
  foreignKey: 'assessmentConfigurationId',
});

export { AssessmentReviewHistory };
export default AssessmentReviewHistory;
