import logging

def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        #time, severity, logger name, text
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )



