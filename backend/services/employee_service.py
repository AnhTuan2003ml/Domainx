from db import employee_store


def list_employees(db_path):
    return employee_store.list_employees(db_path)


def replace_all(db_path, employees):
    return employee_store.replace_all(db_path, employees)


def employee_emails_by_id(db_path):
    return employee_store.employee_emails_by_id(db_path)


def delete_employee(db_path, employee_id, current_user_email=""):
    return employee_store.delete_employee(db_path, employee_id, current_user_email)
