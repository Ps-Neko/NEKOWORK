// positive: JUnit 5 @Disabled / JUnit 4 @Ignore skip a test
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

class PaymentTest {
  @Disabled("flaky in CI")
  @Test
  void chargesCard() {
    assert charge() == OK;
  }

  @Ignore
  @Test
  void refunds() {}
}
