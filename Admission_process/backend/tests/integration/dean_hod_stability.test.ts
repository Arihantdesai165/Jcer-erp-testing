import sequelize from '../../src/config/database';
import * as deanController from '../../src/controllers/dean.controller';
import * as hodController from '../../src/controllers/hod.controller';
import Department from '../../src/models/Department';
import User from '../../src/models/User';
import HOD from '../../src/models/HOD';

describe('Dean & HOD Stability Integration Tests', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('1. Health Check & Database Connectivity', () => {
    it('should verify database connectivity via SELECT 1', async () => {
      const [results] = await sequelize.query('SELECT 1 as result');
      expect(results).toBeDefined();
      expect((results as any)[0].result).toBe(1);
    });
  });

  describe('2. Dean Faculty Directory API', () => {
    it('should return active faculty list with 200 and standard contract shape', async () => {
      const deanUser = await User.findOne({ where: { role: 'DEAN' } });
      req = {
        query: { page: '1', limit: '20', departmentId: 'ALL', status: 'ALL' },
        user: { id: deanUser?.id || 'dean-id', role: 'DEAN' },
      };

      await deanController.getFacultyList(req, res, () => {});

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should filter faculty by departmentId without error', async () => {
      const dept = await Department.findOne();
      req = {
        query: { departmentId: dept ? dept.id : 'ALL', status: 'ALL' },
        user: { id: 'test-dean-id', role: 'DEAN' },
      };

      await deanController.getFacultyList(req, res, () => {});

      expect(res.status).not.toHaveBeenCalledWith(500);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should filter archived faculty when status=ARCHIVED', async () => {
      req = {
        query: { status: 'ARCHIVED', departmentId: 'ALL' },
        user: { id: 'test-dean-id', role: 'DEAN' },
      };

      await deanController.getFacultyList(req, res, () => {});

      expect(res.status).not.toHaveBeenCalledWith(500);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('3. HOD Subject Handling Requests API', () => {
    it('should return 200 with data array and never 404 or 500 when empty', async () => {
      req = {
        query: {},
        user: { id: 'test-dean-id', role: 'DEAN' },
      };

      await deanController.getHodSubjectRequests(req, res, () => {});

      expect(res.status).not.toHaveBeenCalledWith(404);
      expect(res.status).not.toHaveBeenCalledWith(500);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('4. HOD Dashboard and Department Metadata', () => {
    it('should return HOD department metadata for DEAN / HOD user', async () => {
      const activeHod = await HOD.findOne({
        where: { isActive: true },
        include: [{ model: User, as: 'user' }, { model: Department, as: 'department' }],
      });
      if (activeHod) {
        req = {
          user: { id: activeHod.userId, role: 'HOD' },
          departmentId: activeHod.departmentId,
          department: (activeHod as any).department,
          hod: activeHod,
          isSemesterHandling: (activeHod as any).department?.type === 'SEMESTER_HANDLING',
          query: {},
        };

        await hodController.getDepartment(req, res, () => {});

        expect(res.status).not.toHaveBeenCalledWith(500);
        const response = res.json.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
      }
    });

    it('should return HOD dashboard metrics without 500 error', async () => {
      const activeHod = await HOD.findOne({
        where: { isActive: true },
        include: [{ model: User, as: 'user' }, { model: Department, as: 'department' }],
      });
      if (activeHod) {
        req = {
          user: { id: activeHod.userId, role: 'HOD' },
          departmentId: activeHod.departmentId,
          department: (activeHod as any).department,
          hod: activeHod,
          isSemesterHandling: (activeHod as any).department?.type === 'SEMESTER_HANDLING',
          query: {},
        };

        await hodController.getHodDashboard(req, res, () => {});

        expect(res.status).not.toHaveBeenCalledWith(500);
        const response = res.json.mock.calls[0][0];
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
      }
    });
  });
});
