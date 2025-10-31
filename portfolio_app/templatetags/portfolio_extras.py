from django import template
from datetime import datetime
from dateutil.relativedelta import relativedelta

register = template.Library()

@register.filter
def split(value, arg):
    return value.split(arg)

@register.filter
def format_date(value):
    if value == "Current":
        return "Present"
    try:
        date = datetime.strptime(value, '%Y-%m-%d')
        return date.strftime('%B %Y')
    except (ValueError, TypeError):
        return value

@register.filter
def calculate_duration(start_date, end_date):
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d')
        if end_date == "Current":
            end = datetime.now()
        else:
            end = datetime.strptime(end_date, '%Y-%m-%d')
        
        rd = relativedelta(end, start)
        years = rd.years
        months = rd.months
        
        if years > 0:
            if months > 0:
                return f"({years} year{'s' if years != 1 else ''}, {months} month{'s' if months != 1 else ''})"
            return f"({years} year{'s' if years != 1 else ''})"
        return f"({months} month{'s' if months != 1 else ''})"
    except (ValueError, TypeError):
        return ""