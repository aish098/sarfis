const companyRepository = require('../repositories/companyRepository');
const { getPagination, formatPaginatedResponse } = require('../utils/pagination');

class CompanyService {
  async getAllCompanies(query) {
    const { page, limit, sort, order, offset } = getPagination(query);
    const { search } = query;

    const { companies, totalItems } = await companyRepository.findAll({
      offset,
      limit,
      sort,
      order,
      search
    });

    return formatPaginatedResponse({ data: companies, totalItems, page, limit });
  }

  async getCompanyById(id) {
    const company = await companyRepository.findById(id);
    if (!company) {
      const AppError = require('../errors/AppError');
      throw new AppError(`Company with ID '${id}' not found.`, 404, 'COMPANY_NOT_FOUND');
    }
    return company;
  }
}

module.exports = new CompanyService();
