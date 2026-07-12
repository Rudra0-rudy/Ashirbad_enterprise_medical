ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
]
TENS = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
]


def _two_digits(n):
    if n < 20:
        return ONES[n]
    return (TENS[n // 10] + (" " + ONES[n % 10] if n % 10 else "")).strip()


def _three_digits(n):
    if n >= 100:
        return (ONES[n // 100] + " Hundred" + (" " + _two_digits(n % 100) if n % 100 else "")).strip()
    return _two_digits(n)


def amount_in_words(amount):
    """Convert a rupee amount to words using the Indian numbering system
    (thousand / lakh / crore), e.g. 1234567 -> 'Twelve Lakh Thirty Four
    Thousand Five Hundred Sixty Seven Rupees Only'.
    """
    try:
        rupees = int(round(float(amount)))
    except (TypeError, ValueError):
        rupees = 0

    if rupees == 0:
        return "Zero Rupees Only"

    crore, rupees = divmod(rupees, 10_000_000)
    lakh, rupees = divmod(rupees, 100_000)
    thousand, rupees = divmod(rupees, 1_000)
    hundred = rupees

    parts = []
    if crore:
        parts.append(_three_digits(crore) + " Crore")
    if lakh:
        parts.append(_three_digits(lakh) + " Lakh")
    if thousand:
        parts.append(_three_digits(thousand) + " Thousand")
    if hundred:
        parts.append(_three_digits(hundred))

    return " ".join(parts) + " Rupees Only"
